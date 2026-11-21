import LoginForm from "./LoginForm";
import { demoMode } from "@/lib/env";

export const dynamic = "force-dynamic";
export default function Login() {
  return <LoginForm demo={demoMode()} />;
}
