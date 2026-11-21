import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(creds) {
        const email = creds?.email?.toLowerCase().trim();
        if (!email || !creds?.password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;
        const ok = await bcrypt.compare(creds.password, user.passwordHash);
        if (!ok) return null;
        await prisma.auditLog.create({ data: { userId: user.id, action: "login" } });
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

export type SessionUser = { id: string; name: string; email: string; role: Role; buildingId: string };

export async function currentUser(): Promise<SessionUser | null> {
  const s = await getServerSession(authOptions);
  return (s?.user as SessionUser) ?? null;
}

/** For pages and server actions: redirects to /login, or home if the role is not allowed. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (roles.length && !roles.includes(u.role)) redirect("/");
  return u;
}

export const homeFor = (role: Role) => (role === "OWNER" ? "/my" : role === "BOARD" ? "/board" : role === "ADMIN" ? "/admin/users" : "/work-orders");

export async function audit(userId: string | null, action: string, detail?: string) {
  await prisma.auditLog.create({ data: { userId, action, detail } });
}
