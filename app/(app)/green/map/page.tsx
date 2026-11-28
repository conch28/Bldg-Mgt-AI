import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import CityMap from "@/components/city/CityMap";
import { clientFrom } from "@/lib/remote";

export const metadata = { title: "3D city map" };

export default async function GreenMap({ searchParams }: { searchParams: { focus?: string; alert?: string; present?: string; client?: string } }) {
  const u = await requireRole("CLIENT", "BOARD", "MANAGER", "ADMIN");
  // Branding: ?client=bcda or ?client=pax, or the client demo login's own name (ncc@ / bcda@ → BCDA, pax@ → Pax Silica).
  const client = clientFrom(typeof searchParams.client === "string" ? searchParams.client : u.role === "CLIENT" ? u.email.split("@")[0] : undefined);
  const focus = typeof searchParams.focus === "string" ? searchParams.focus.slice(0, 40) : undefined;
  const alert = typeof searchParams.alert === "string" ? searchParams.alert.slice(0, 40) : undefined;
  // Optional: turns on the Google photorealistic 3D look. The key reaches the browser, so restrict it
  // in Google Cloud to this site's domain and to the Map Tiles API. Without it the map uses free satellite imagery.
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;
  return (
    <>
      <PageHead title="3D city map" sub="New Clark City to Clark Freeport: every building, live power, water, solar, carbon and rankings. Real map, sample data." back="/green" right={<span className="row cm-headlinks" style={{ gap: 6, flexWrap: "wrap" }}><Link href="/green" className="btn">Sustainability dashboard</Link><Link href="/green/clark" className="btn">Clark command center</Link></span>} />
      <main className="view">
        <CityMap focus={focus} alert={alert} googleKey={googleKey} present={searchParams.present === "manual" ? "manual" : searchParams.present ? "auto" : undefined} client={client} />
      </main>
    </>
  );
}
