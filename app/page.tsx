import TimelineCanvas from "@/components/timeline/TimelineCanvas";
import type { TimelinePeriod } from "@/lib/types";

export const dynamic = "force-static";

async function loadTimeline(): Promise<TimelinePeriod[] | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { getTimeline } = await import("@/lib/queries");
    return await getTimeline();
  } catch (err) {
    console.error("timeline query failed:", err);
    return null;
  }
}

export default async function Home() {
  const periods = await loadTimeline();

  if (!periods || periods.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-serif text-3xl tracking-[0.3em] text-[#e8e3d5]">MUSÉE</h1>
        <p className="max-w-md text-sm leading-relaxed text-[#8a8470]">
          The collection has not been installed yet. Set <code>DATABASE_URL</code> in{" "}
          <code>.env.local</code> and run <code>pnpm seed --write</code> to fill the
          galleries from Wikipedia.
        </p>
      </main>
    );
  }

  return <TimelineCanvas periods={periods} />;
}
