import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import LoginForm from "../login/LoginForm";
import { demoMode } from "@/lib/env";
import { authOptions } from "@/lib/auth";

// Short, shareable link to the 3D city map demo: one tap (or none) and it opens on the map.
export const metadata = { title: "3D city map · New Clark City to Clark", description: "Live 3D map of New Clark City and Clark Freeport: energy, water, report cards, typhoon drill and 2030 plan (sample data)" };
export const dynamic = "force-dynamic";
export default async function MapDemo({ searchParams }: { searchParams: { client?: string } }) {
  const q = searchParams.client === "bcda" || searchParams.client === "pax" ? `?client=${searchParams.client}` : "";
  const s = await getServerSession(authOptions);
  if (s?.user) redirect(`/green/map${q}`);
  if (!demoMode()) redirect(`/login?callbackUrl=${encodeURIComponent("/green/map" + q)}`);
  return <LoginForm demo client="ncc" next={`/green/map${q}`} />;
}
