import { redirect } from "next/navigation";
import LoginForm from "../login/LoginForm";
import { demoMode } from "@/lib/env";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { BCDA_LOGIN } from "@/lib/bcda";

// Short, shareable BCDA demo link: opens straight into the NGAC building, with no Skyland branding.
export const metadata = { title: "NGAC Government Building · BCDA demo", description: "Building management demo for the NGAC Government Building, New Clark City", applicationName: "BCDA demo", appleWebApp: { title: "BCDA demo" } };
export const dynamic = "force-dynamic";
export default async function BcdaDemo({ searchParams }: { searchParams: { out?: string } }) {
  if (!demoMode()) redirect("/login");
  const s = await getServerSession(authOptions);
  if (s?.user?.email?.toLowerCase() === BCDA_LOGIN) redirect("/green/bcda");
  // After signing out (?out=1) show the one-tap button instead of signing straight back in.
  return <LoginForm demo client="bcda" noAuto={searchParams.out === "1"} />;
}
