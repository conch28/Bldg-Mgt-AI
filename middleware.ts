import { withAuth } from "next-auth/middleware";
import { authSecret } from "@/lib/env";

const RULES: [RegExp, string[]][] = [
  [/^\/admin/, ["ADMIN"]],
  [/^\/(board|scorecard|happiness)/, ["BOARD", "MANAGER", "ADMIN"]],
  [/^\/(work-orders|collections|comms|maintenance|vendors|reports)/, ["BOARD", "MANAGER", "ADMIN"]],
  [/^\/today/, ["MANAGER", "ADMIN"]],
  [/^\/frontdesk/, ["MANAGER", "ADMIN", "GUARD"]],
  [/^\/listings/, ["BOARD", "MANAGER", "ADMIN"]],
  [/^\/(moving|registrations|sos)(\/|$)/, ["OWNER", "MANAGER", "ADMIN", "GUARD"]],
  [/^\/(home|my|chat|services|passes|updates|property)(\/|$)/, ["OWNER"]],
];

export default withAuth({
  secret: authSecret(),
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ token, req }) {
      if (!token) return false;
      const rule = RULES.find(([re]) => re.test(req.nextUrl.pathname));
      return !rule || rule[1].includes(token.role as string);
    },
  },
});

export const config = { matcher: ["/((?!api/auth|api/cron|api/paymongo|api/health|api/log-error|login|privacy|offline|_next|favicon.ico|robots.txt|manifest.webmanifest|sw.js|icons).*)"] };
