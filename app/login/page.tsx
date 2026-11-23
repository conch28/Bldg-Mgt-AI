import LoginForm from "./LoginForm";
import { demoMode } from "@/lib/env";

export const dynamic = "force-dynamic";
export default function Login({ searchParams }: { searchParams: { client?: string } }) {
  // /login?client=ncc, pax or bcda opens straight onto that client's sustainability demo.
  const client = ["ncc", "pax", "bcda"].includes(searchParams.client ?? "") ? searchParams.client : undefined;
  return <LoginForm demo={demoMode()} client={client} />;
}
