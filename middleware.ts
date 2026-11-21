import { withAuth } from "next-auth/middleware";

const RULES: [RegExp, string[]][] = [
  [/^\/admin/, ["ADMIN"]],
  [/^\/(board|finances|scorecard)/, ["BOARD", "MANAGER", "ADMIN"]],
  [/^\/(work-orders|collections)/, ["BOARD", "MANAGER", "ADMIN"]],
];

export default withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ token, req }) {
      if (!token) return false;
      const rule = RULES.find(([re]) => re.test(req.nextUrl.pathname));
      return !rule || rule[1].includes(token.role as string);
    },
  },
});

export const config = { matcher: ["/((?!api/auth|login|_next|favicon.ico|robots.txt).*)"] };
