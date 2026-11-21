import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Skyland · Building Mgt AI", short_name: "Skyland", description: "Pay dues, report problems, book amenities, rent out or sell your unit, and get building updates.",
    start_url: "/", scope: "/", display: "standalone", orientation: "portrait", background_color: "#0e2725", theme_color: "#0e2725",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Report a problem", url: "/chat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Pay dues", url: "/my", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Emergency SOS", url: "/sos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
