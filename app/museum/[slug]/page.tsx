import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MuseumShell from "@/components/museum/MuseumShell";
import { getAllArtistSlugs, getArtistCard, getMuseum } from "@/lib/collection";

export const dynamic = "force-static";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    return (await getAllArtistSlugs()).map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const artist = await getArtistCard(slug);
    if (!artist) return {};
    return {
      title: `${artist.name} — Musée`,
      description: artist.bio.slice(0, 160),
    };
  } catch {
    return {};
  }
}

export default async function MuseumPage({ params }: Props) {
  const { slug } = await params;
  const data = await getMuseum(slug);
  if (!data || data.artworks.length === 0) notFound();
  return <MuseumShell data={data} />;
}
