import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { authSecret } from "@/lib/env";

const VIEWERS = ["INVESTOR", "LANDLORD"];
const VIEWER_HOME: Record<string, string> = { INVESTOR: "/investor", LANDLORD: "/building-owner" };
const viewerOk = (role: string, path: string) => /^\/($|account(\/|$)|consent(\/|$))/.test(path) || path === VIEWER_HOME[role] || path.startsWith(VIEWER_HOME[role] + "/");

const RULES: [RegExp, string[]][] = [
  [/^\/investor(\/|$)/, ["INVESTOR", "ADMIN"]],
  [/^\/building-owner(\/|$)/, ["LANDLORD", "BOARD", "ADMIN"]],
  [/^\/admin/, ["ADMIN"]],
  [/^\/(board|scorecard|happiness)/, ["BOARD", "MANAGER", "ADMIN"]],
  [/^\/(work-orders|collections|comms|maintenance|vendors|reports)/, ["BOARD", "MANAGER", "ADMIN"]],
  [/^\/today/, ["MANAGER", "ADMIN"]],
  [/^\/data\/assets\/(?!(qr|import)$)[^/]+$/, ["BOARD", "MANAGER", "ADMIN", "GUARD"]], // asset QR pages: guards scan to report faults
  [/^\/data(\/|$)/, ["BOARD", "MANAGER", "ADMIN"]],
  [/^\/tasks(\/|$)/, ["MANAGER", "ADMIN", "GUARD", "BOARD"]],
  [/^\/(duties|integrity)(\/|$)/, ["BOARD", "MANAGER", "ADMIN"]],
  [/^\/(energy|meetings|equipment|channels)(\/|$)/, ["BOARD", "MANAGER", "ADMIN"]],
  [/^\/neighbors(\/|$)/, ["OWNER", "BOARD", "MANAGER", "ADMIN"]],
  [/^\/frontdesk/, ["MANAGER", "ADMIN", "GUARD"]],
  [/^\/listings/, ["BOARD", "MANAGER", "ADMIN"]],
  [/^\/(moving|registrations|sos)(\/|$)/, ["OWNER", "MANAGER", "ADMIN", "GUARD"]],
  [/^\/(home|my|chat|services|passes|updates|property|report)(\/|$)/, ["OWNER"]],
];

export default withAuth((req) => {
  const role = req.nextauth.token?.role as string | undefined;
  if (role && VIEWERS.includes(role) && !viewerOk(role, req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL(VIEWER_HOME[role], req.url));
  }
}, {
  secret: authSecret(),
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ token, req }) {
      if (!token) return false;
      // Read-only viewers only reach their own summary page and their account; anything else is sent home below.
      if (VIEWERS.includes(token.role as string) && !viewerOk(token.role as string, req.nextUrl.pathname)) return true;
      const rule = RULES.find(([re]) => re.test(req.nextUrl.pathname));
      return !rule || rule[1].includes(token.role as string);
    },
  },
});

export const config = { matcher: ["/((?!api/auth|api/cron|api/paymongo|api/messenger|api/viber|p/|j/|api/health|api/log-error|login|privacy|offline|_next|favicon.ico|robots.txt|manifest.webmanifest|sw.js|icons).*)"] };
