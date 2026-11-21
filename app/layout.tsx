import "./globals.css";
import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/Pwa";

export const metadata: Metadata = {
  title: "Skyland · Building Mgt AI", description: "AI-first building management for Skyland Plaza",
  applicationName: "Skyland", appleWebApp: { capable: true, title: "Skyland", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/favicon-64.png", sizes: "64x64" }, { url: "/icons/icon-192.png", sizes: "192x192" }], apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0e2725" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap" />
      </head>
      <body>{children}<RegisterSW /></body>
    </html>
  );
}
