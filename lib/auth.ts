import { authSecret } from "./env";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { rateLimit, clientIp } from "./ratelimit";
import { verifyCode } from "./otp";
import { demoMode } from "./env";

export const authOptions: NextAuthOptions = {
  secret: authSecret(),
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(creds, req) {
        const email = creds?.email?.toLowerCase().trim();
        // Demo site (DEMO_MODE): no passwords. An email alone signs in to any active account.
        const passwordless = demoMode();
        if (!email || (!creds?.password && !passwordless)) return null;
        const ip = clientIp(req?.headers as any);
        const [a, b] = await Promise.all([rateLimit(`pw:${email}`, demoMode() ? 60 : 8, 900), rateLimit(`pw-ip:${ip}`, demoMode() ? 200 : 30, 900)]);
        if (!a.ok || !b.ok) throw new Error("RATE_LIMIT");
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;
        if (!passwordless) {
          const ok = await bcrypt.compare(creds!.password, user.passwordHash);
          if (!ok) { await audit(user.id, "login_failed", "Wrong password"); return null; }
        }
        await prisma.auditLog.create({ data: { userId: user.id, action: "login", detail: passwordless ? "demo, no password" : "password" } });
        return { id: user.id, email: user.email, name: user.name, role: user.role, buildingId: user.buildingId } as any;
      },
    }),
    Credentials({
      id: "otp",
      name: "One-time code",
      credentials: { identifier: { label: "Email or mobile", type: "text" }, code: { label: "Code", type: "text" } },
      async authorize(creds, req) {
        const identifier = creds?.identifier?.trim().toLowerCase();
        const code = creds?.code?.replace(/\D/g, "");
        if (!identifier || !code) return null;
        const ip = clientIp(req?.headers as any);
        const [a, b] = await Promise.all([rateLimit(`otp-v:${identifier}`, 10, 900), rateLimit(`otp-v-ip:${ip}`, 40, 900)]);
        if (!a.ok || !b.ok) throw new Error("RATE_LIMIT");
        const user = await verifyCode(identifier, code);
        if (!user) return null;
        await prisma.auditLog.create({ data: { userId: user.id, action: "login", detail: "one-time code" } });
        return { id: user.id, email: user.email, name: user.name, role: user.role, buildingId: user.buildingId } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.role = (user as any).role; token.buildingId = (user as any).buildingId; token.uid = user.id; }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = token.uid; (session.user as any).role = token.role; (session.user as any).buildingId = token.buildingId;
      return session;
    },
  },
};

export type SessionUser = { id: string; name: string; email: string; role: Role; buildingId: string; consented?: boolean };

export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const s = await getServerSession(authOptions);
  const u = (s?.user as SessionUser) ?? null;
  if (!u?.id) return null;
  // A disabled or deleted account loses access at once, not when its 12-hour session runs out.
  const db = await prisma.user.findUnique({ where: { id: u.id }, select: { active: true, role: true, name: true, consentAt: true } });
  if (!db || !db.active) return null;
  return { ...u, role: db.role, name: db.name, consented: Boolean(db.consentAt) };
});

/** For pages and server actions: redirects to /login, or home if the role is not allowed. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (roles.length && !roles.includes(u.role)) redirect("/");
  return u;
}

/** Read-only demo viewers. They see one summary page each and can't change anything. */
export const VIEWERS: Role[] = ["INVESTOR", "LANDLORD", "CLIENT"];
/** Everyone who uses the building day to day (all roles except the read-only viewers). */
export const PEOPLE: Role[] = ["OWNER", "BOARD", "MANAGER", "ADMIN", "GUARD"];

export const homeFor = (role: Role) =>
  role === "OWNER" ? "/home" : role === "BOARD" ? "/board" : role === "GUARD" ? "/frontdesk" : role === "INVESTOR" ? "/investor" : role === "LANDLORD" ? "/building-owner" : role === "CLIENT" ? "/green" : "/today";

export async function audit(userId: string | null, action: string, detail?: string) {
  await prisma.auditLog.create({ data: { userId, action, detail } });
}
