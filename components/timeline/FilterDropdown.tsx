"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { TimelinePeriod } from "@/lib/types";
import { useTimelineStore } from "@/stores/timelineStore";

interface Props {
  periods: TimelinePeriod[];
  onSelectPeriod: (slug: string) => void;
  onSelectArtist: (slug: string) => void;
}

interface Option {
  kind: "all" | "period" | "artist";
  slug: string;
  label: string;
  sub: string;
  color?: string;
  portrait?: string;
}

/** The "Celestial Index" — the filter is itself a small theatrical moment. */
export default function FilterDropdown({ periods, onSelectPeriod, onSelectArtist }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const focus = useTimelineStore((s) => s.focus);

  const artists = useMemo(
    () =>
      periods.flatMap((p) =>
        p.artists.map((a) => ({ artist: a, period: p })),
      ),
    [periods],
  );

  const options: Option[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length > 0) {
      return artists
        .filter(({ artist }) => artist.name.toLowerCase().includes(q))
        .slice(0, 12)
        .map(({ artist, period }) => ({
          kind: "artist" as const,
          slug: artist.slug,
          label: artist.name,
          sub: `${artist.birthYear ?? "?"} – ${artist.deathYear ?? ""} · ${period.name}`,
          color: period.color,
          portrait: artist.portraitUrl330,
        }));
    }
    return [
      { kind: "all" as const, slug: "", label: "Show all skies", sub: "clear filter" },
      ...periods.map((p) => ({
        kind: "period" as const,
        slug: p.slug,
        label: p.name,
        sub: `${p.startYear} – ${p.endYear}`,
        color: p.color,
      })),
    ];
  }, [query, periods, artists]);

  useEffect(() => setActive(0), [query, open]);

  // entrance stagger — the filter "moment"
  useGSAP(
    () => {
      if (!open || !panelRef.current) return;
      gsap.fromTo(
        panelRef.current,
        { autoAlpha: 0, y: -8, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: "power3.out" },
      );
      gsap.fromTo(
        panelRef.current.querySelectorAll("[data-row]"),
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.028, ease: "power2.out", delay: 0.08 },
      );
    },
    { dependencies: [open, query], scope: panelRef },
  );

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const select = (opt: Option) => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
    if (opt.kind === "all") {
      useTimelineStore.getState().setFocus(null);
    } else if (opt.kind === "period") {
      onSelectPeriod(opt.slug);
    } else {
      onSelectArtist(opt.slug);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) select(options[active]);
    }
  };

  const focusLabel =
    focus?.kind === "period"
      ? periods.find((p) => p.slug === focus.slug)?.name
      : focus?.kind === "artist"
        ? artists.find((a) => a.artist.slug === focus.slug)?.artist.name
        : null;

  return (
    <div className="fixed left-5 top-5 z-30 font-sans">
      <button
        ref={triggerRef}
        data-testid="filter-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="group flex items-center gap-2.5 rounded-xl border border-[#c9a96a]/25 bg-[#0a0e1a]/70 px-4 py-2.5 text-[13px] tracking-[0.14em] text-[#e8e3d5] backdrop-blur-xl transition-colors hover:border-[#c9a96a]/50"
      >
        <span className="text-[#c9a96a]">✦</span>
        <span style={{ fontVariantCaps: "small-caps" }}>Celestial Index</span>
        {focusLabel && (
          <span className="max-w-40 truncate rounded-md bg-[#c9a96a]/15 px-2 py-0.5 text-[11px] text-[#c9a96a]">
            {focusLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          data-testid="filter-panel"
          onKeyDown={onKeyDown}
          className="mt-2 w-[340px] overflow-hidden rounded-xl border border-[#c9a96a]/25 shadow-2xl shadow-black/60"
          style={{
            background: "rgba(10, 14, 26, 0.78)",
            backdropFilter: "blur(16px) saturate(1.2)",
            WebkitBackdropFilter: "blur(16px) saturate(1.2)",
          }}
        >
          <div className="border-b border-[#c9a96a]/15 p-3">
            <input
              ref={searchRef}
              data-testid="filter-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artists…"
              aria-label="Search artists"
              className="w-full rounded-lg border border-transparent bg-[#050810]/70 px-3 py-2 text-[13px] text-[#e8e3d5] placeholder-[#6b6555] outline-none transition-colors focus:border-[#c9a96a]/40"
            />
          </div>
          <ul
            role="listbox"
            aria-label={query ? "Artists" : "Art periods"}
            aria-activedescendant={options[active] ? `opt-${options[active].kind}-${options[active].slug}` : undefined}
            className="max-h-[56vh] overflow-y-auto py-1.5"
          >
            {options.length === 0 && (
              <li className="px-4 py-3 text-[13px] text-[#6b6555]">No artists match.</li>
            )}
            {options.map((opt, i) => (
              <li
                key={`${opt.kind}-${opt.slug}`}
                id={`opt-${opt.kind}-${opt.slug}`}
                data-row
                data-testid={`filter-option-${opt.slug || "all"}`}
                role="option"
                aria-selected={i === active}
                onPointerEnter={() => setActive(i)}
                onClick={() => select(opt)}
                className={`mx-1.5 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  i === active ? "bg-[#c9a96a]/12" : ""
                }`}
              >
                {opt.kind === "artist" && opt.portrait ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={opt.portrait}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded-full border border-[#c9a96a]/30 object-cover"
                  />
                ) : (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: opt.color ?? "#6b6555",
                      boxShadow: opt.color ? `0 0 8px ${opt.color}` : undefined,
                    }}
                  />
                )}
                <span className="min-w-0 flex-1 truncate font-serif text-[15px] text-[#e8e3d5]">
                  {opt.label}
                </span>
                <span
                  className="shrink-0 text-[11px] tracking-wide text-[#8a8470]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {opt.sub}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
