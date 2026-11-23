import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import CityMap from "@/components/city/CityMap";

export const metadata = { title: "3D city map" };

export default async function GreenMap({ searchParams }: { searchParams: { focus?: string; alert?: string } }) {
  await requireRole("CLIENT", "BOARD", "MANAGER", "ADMIN");
  const focus = typeof searchParams.focus === "string" ? searchParams.focus.slice(0, 40) : undefined;
  const alert = typeof searchParams.alert === "string" ? searchParams.alert.slice(0, 40) : undefined;
  return (
    <>
      <PageHead title="3D city map" sub="New Clark City to Clark Freeport: every building, live power, water, solar and carbon. Real map, sample data." back="/green" right={<span className="row cm-headlinks" style={{ gap: 6, flexWrap: "wrap" }}><Link href="/green" className="btn">Sustainability dashboard</Link><Link href="/green/clark" className="btn">Clark command center</Link></span>} />
      <main className="view">
        <CityMap focus={focus} alert={alert} />
      </main>
    </>
  );
}
