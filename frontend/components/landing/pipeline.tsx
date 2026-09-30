"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

type Stage = {
  id: string;
  name: string;
  short: string;
  detail: string;
  input: string;
  output: string;
};

const STAGES: Stage[] = [
  {
    id: "01",
    name: "CNN Screening",
    short: "Global embedding match",
    detail:
      "ResNet50 generates a compact global embedding for the query frame. Dot-product similarity against the pre-computed database index rapidly narrows 600+ archive frames down to the top-10 candidates — lightning-fast deep global vector screening.",
    input: "Query image + HF database",
    output: "Top-10 candidate frames",
  },
  {
    id: "02",
    name: "SIFT Extract",
    short: "Local feature detection",
    detail:
      "SIFT detects up to 5000 keypoints with contrast and edge thresholds tuned for lunar terrain. RootSIFT (Hellinger kernel) normalization is applied for improved matching performance under illumination changes.",
    input: "Query + candidate frames",
    output: "Keypoints + RootSIFT descriptors",
  },
  {
    id: "03",
    name: "Ratio Match",
    short: "Propose correspondences",
    detail:
      "Nearest-neighbour matching with Lowe's ratio test (0.75 threshold) on RootSIFT descriptors. Mutual best-match filtering and cross-check fallback ensure only high-confidence candidate pairs survive.",
    input: "RootSIFT descriptors",
    output: "Candidate point pairs",
  },
  {
    id: "04",
    name: "Consensus Vote",
    short: "Spatial grid voting",
    detail:
      "Top-5 candidates vote on their geographic grid cell (parsed from filename lat/lon). The winning grid cell with majority votes locks onto the correct geographic region — spatial consensus ensemble filtering.",
    input: "Top-5 candidates + grid IDs",
    output: "Winning geographic cell",
  },
  {
    id: "05",
    name: "MAGSAC Reject",
    short: "Outlier rejection",
    detail:
      "USAC_MAGSAC homography estimation with 3.0px reprojection threshold and 3000 max iterations. Robust outlier rejection removes mismatches while preserving geometrically consistent inliers — far superior to standard RANSAC.",
    input: "Candidate pairs + homography",
    output: "Verified inliers + transform",
  },
  {
    id: "06",
    name: "Subpixel Refine",
    short: "Phase correlation",
    detail:
      "Local phase correlation with Hanning window provides fractional-pixel correction to geometrically predicted match points. Only refinements with sufficient phase response (>0.05) are accepted.",
    input: "Inlier matches + images",
    output: "Sub-pixel refined pairs",
  },
  {
    id: "07",
    name: "Uniform Select",
    short: "Grid binning",
    detail:
      "Inliers are binned across an 8×8 grid and capped per cell so retained control points cover the frame evenly. Uniform spatial distribution ensures a stable, well-conditioned transform fit.",
    input: "Refined inlier set",
    output: "Uniform control points",
  },
  {
    id: "08",
    name: "Geolocate",
    short: "Extract coordinates",
    detail:
      "The matched frame's filename encodes its geographic bounds (lat/lon ranges). These are parsed and returned as the final localization result — the pixel coordinates on the lunar surface where the query image was captured.",
    input: "Matched frame filename",
    output: "Lat/lon geographic bounds",
  },
  {
    id: "09",
    name: "Evaluate",
    short: "Report the numbers",
    detail:
      "RMSE on verified inliers, consensus confidence score, inlier count and ratio, processing time — plus match-line overlays and coverage diagnostics for visual inspection.",
    input: "Registration result",
    output: "Metrics + visualisations",
  },
];

export function Pipeline() {
  const [activeId, setActiveId] = useState<string>("05");
  const reduced = useReducedMotion();
  const active = STAGES.find((s) => s.id === activeId) ?? (STAGES[0] as Stage);

  return (
    <section id="pipeline" className="scroll-mt-24 border-t border-line/60 bg-surface/50">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <SectionHeading
          index="04"
          eyebrow="HOW IT WORKS"
          title="Nine stages, from CNN screening to geographic localization."
          note="Select a stage to see what enters it and what leaves it."
        />

        <div
          role="tablist"
          aria-label="Registration pipeline stages"
          className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-3 sm:mx-0 sm:px-0"
        >
          {STAGES.map((stage) => {
            const isActive = stage.id === activeId;
            return (
              <button
                key={stage.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setActiveId(stage.id)}
                className={`w-36 shrink-0 snap-start rounded-lg p-3 text-left transition-colors ${
                  isActive
                    ? "bg-signal/10 ring-1 ring-signal/50"
                    : "panel-glass ring-1 ring-white/10 hover:ring-mist/40"
                }`}
              >
                <div
                  className={`font-mono text-[10px] tracking-[0.14em] ${
                    isActive ? "text-signal" : "text-ash"
                  }`}
                >
                  STAGE {stage.id}
                </div>
                <div
                  className={`mt-1 text-sm font-semibold ${isActive ? "text-signal" : "text-bone"}`}
                >
                  {stage.name}
                </div>
                <p className="mt-1.5 text-xs leading-snug text-mist">{stage.short}</p>
              </button>
            );
          })}
        </div>

        <Reveal className="mt-4">
          <div className="panel-glass rounded-xl p-6 ring-1 ring-white/10 sm:p-8">
            <motion.div
              key={active.id}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10"
            >
              <div>
                <div className="font-mono text-[10px] tracking-[0.18em] text-signal">
                  STAGE {active.id} · {active.name.toUpperCase()}
                </div>
                <p className="mt-3 max-w-[62ch] text-pretty text-base leading-relaxed text-mist">
                  {active.detail}
                </p>
              </div>
              <dl className="grid content-start gap-3 border-t border-line/60 pt-5 font-mono text-xs lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <div className="flex justify-between gap-4">
                  <dt className="text-ash">IN</dt>
                  <dd className="text-right text-bone">{active.input}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ash">OUT</dt>
                  <dd className="text-right text-bone">{active.output}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ash">POSITION</dt>
                  <dd className="tabular text-right text-signal">{active.id} / 9</dd>
                </div>
              </dl>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
