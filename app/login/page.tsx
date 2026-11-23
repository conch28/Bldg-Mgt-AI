import LoginForm from "./LoginForm";
import { demoMode } from "@/lib/env";

export const dynamic = "force-dynamic";
export default function Login({ searchParams }: { searchParams: { client?: string } }) {
  // /login?client=ncc or ?client=pax opens straight onto that client's sustainability demo.
  const client = searchParams.client === "ncc" || searchParams.client === "pax" ? searchParams.client : undefined;
  return <LoginForm demo={demoMode()} client={client} />;
}
