"use client";

import { useState } from "react";
import Image, { type StaticImageData } from "next/image";
import type { MatchPoint } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type LunarImg = StaticImageData | string;

type Props = {
  matches: MatchPoint[];
  sourceImg: LunarImg;
  referenceImg: LunarImg;
  sourceLabel?: string;
  referenceLabel?: string;
};

function FrameImage({ src, alt, className }: { src: LunarImg; alt: string; className?: string }) {
  if (typeof src === "string") {
    return <img src={src} alt={alt} className={className} />;
  }
  return <Image src={src} alt={alt} className={className} />;
}

function MarkerLayer({
  points,
  coord,
  showOutliers,
}: {
  points: MatchPoint[];
  coord: (m: MatchPoint) => [number, number];
  showOutliers: boolean;
}) {
  const visible = points.filter((m) => m.isInlier || showOutliers);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      {visible.map((m, i) => {
        const [x, y] = coord(m);
        return (
          <g key={m.id}>
            <circle cx={x * 100} cy={y * 100} r={2.1} fill={m.isInlier ? "var(--signal)" : "var(--destructive)"} fillOpacity={m.isInlier ? 0.9 : 0.55} vectorEffect="non-scaling-stroke" stroke="var(--void)" strokeWidth={1.2} />
            <text x={x * 100} y={y * 100 - 3.2} textAnchor="middle" fontSize={4.4} fill={m.isInlier ? "var(--signal)" : "var(--destructive)"} fontFamily="var(--font-plex), monospace">
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MatchViewer({ matches, sourceImg, referenceImg, sourceLabel = "SOURCE · moving", referenceLabel = "REFERENCE · fixed" }: Props) {
  const [mode, setMode] = useState<"split" | "blend">("split");
  const [showOutliers, setShowOutliers] = useState(true);
  const [blend, setBlend] = useState(50);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md ring-1 ring-line">
          {(["split", "blend"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] transition-colors",
                mode === m ? "bg-signal text-void" : "text-mist hover:text-bone",
              )}
            >
              {m === "split" ? "SIDE BY SIDE" : "BLEND"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowOutliers((v) => !v)}
          className={cn(
            "rounded-md px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] ring-1 transition-colors",
            showOutliers ? "text-flare ring-flare/40" : "text-mist ring-line hover:text-bone",
          )}
        >
          {showOutliers ? "HIDE OUTLIERS" : "SHOW OUTLIERS"}
        </button>
        <span className="ml-auto font-mono text-[10px] tracking-[0.12em] text-ash">
          {matches.filter((m) => m.isInlier).length}/{matches.length} INLIERS · NUMBERS LINK BOTH PANELS
        </span>
      </div>

      {mode === "split" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { img: sourceImg, label: sourceLabel, coord: (m: MatchPoint): [number, number] => [m.srcX, m.srcY] },
            { img: referenceImg, label: referenceLabel, coord: (m: MatchPoint): [number, number] => [m.refX, m.refY] },
          ].map((p) => (
            <figure key={p.label} className="relative overflow-hidden rounded-xl bg-panel ring-1 ring-white/10">
              <FrameImage src={p.img} alt={p.label} className="aspect-square w-full object-cover" />
              <MarkerLayer points={matches} coord={p.coord} showOutliers={showOutliers} />
              <figcaption className="absolute left-2 top-2 rounded bg-void/70 px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] text-mist">
                {p.label}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-panel ring-1 ring-white/10">
          <FrameImage src={referenceImg} alt={referenceLabel} className="aspect-[16/9] w-full object-cover" />
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - blend}% 0 0)` }}>
            <FrameImage src={sourceImg} alt={sourceLabel} className="aspect-[16/9] w-full object-cover opacity-70 mix-blend-screen" />
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-signal" style={{ left: `${blend}%` }} />
          <span className="absolute left-2 top-2 rounded bg-void/70 px-2 py-0.5 font-mono text-[9px] text-mist">SRC</span>
          <span className="absolute right-2 top-2 rounded bg-void/70 px-2 py-0.5 font-mono text-[9px] text-signal">REF</span>
          <input
            type="range" min={2} max={98} value={blend}
            onChange={(e) => setBlend(Number(e.target.value))}
            aria-label="Blend position"
            className="absolute bottom-3 left-1/2 h-1 w-2/3 -translate-x-1/2 cursor-pointer appearance-none rounded-full bg-line accent-[var(--signal)]"
          />
        </div>
      )}
    </div>
  );
}
