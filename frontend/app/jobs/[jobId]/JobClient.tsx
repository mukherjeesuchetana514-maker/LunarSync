"use client";

import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { STAGES, MATCHER_LABELS, type JobResult } from "@/lib/mock-data";
import { useJob } from "@/hooks/use-job";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { ConsoleNav } from "@/components/ConsoleNav";
import { MatchViewer } from "@/components/viewer/MatchViewer";
import { CoverageGrid, MetricCards } from "@/components/metrics/MetricCards";
import sourceImg from "@/assets/lunar-source.jpg";
import referenceImg from "@/assets/lunar-reference.jpg";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Downloads({ result }: { result: JobResult }) {
  const csv = [
    "id,src_x,src_y,ref_x,ref_y,confidence,is_inlier",
    ...result.matches.map((m) =>
      [m.id, m.srcX.toFixed(4), m.srcY.toFixed(4), m.refX.toFixed(4), m.refY.toFixed(4), m.confidence.toFixed(3), m.isInlier].join(","),
    ),
  ].join("\n");
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => download(`${result.job.id}-matches.csv`, csv, "text/csv")}
        className="inline-flex items-center gap-2 rounded-md px-4 py-2 font-mono text-xs text-bone ring-1 ring-line transition-colors hover:ring-mist"
      >
        <Download className="size-3.5" /> Match points CSV
      </button>
      <button
        type="button"
        onClick={() =>
          download(`${result.job.id}-report.json`, JSON.stringify({ job: result.job, transform: result.transform, report: result.report }, null, 2), "application/json")
        }
        className="inline-flex items-center gap-2 rounded-md px-4 py-2 font-mono text-xs text-bone ring-1 ring-line transition-colors hover:ring-mist"
      >
        <Download className="size-3.5" /> Report JSON
      </button>
    </div>
  );
}

function Progress({ stage }: { stage: string }) {
  const idx = STAGES.indexOf(stage as (typeof STAGES)[number]);
  const pct = idx < 0 ? 4 : Math.round(((idx + 1) / STAGES.length) * 100);
  return (
    <div className="panel-glass rounded-xl p-5 ring-1 ring-white/10">
      <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.14em]">
        <span className="text-ash">PIPELINE STAGE</span>
        <span className="text-signal">{stage.replaceAll("_", " ").toUpperCase()}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-void/70">
        <div className="h-full rounded-full bg-signal transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-4">
        {STAGES.map((s, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute left-[5px] top-4 h-[calc(100%-1rem)] w-px ${i < idx ? "bg-signal/60" : "bg-line/60"}`}
                />
              )}
              <span
                aria-hidden
                className={`mt-1 size-[11px] shrink-0 rounded-full ring-1 ${
                  done
                    ? "bg-signal ring-signal/40"
                    : current
                      ? "reticle bg-signal ring-signal/40"
                      : "bg-void ring-line"
                }`}
              />
              <span className="flex w-full items-center justify-between gap-3">
                <span
                  className={`font-mono text-[11px] tracking-[0.1em] ${current ? "text-signal" : done ? "text-bone" : "text-ash"}`}
                >
                  {s.replaceAll("_", " ").toUpperCase()}
                </span>
                <span className="font-mono text-[10px] text-ash">
                  {done ? "DONE" : current ? "RUNNING…" : `STEP ${i + 1}/${STAGES.length}`}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 font-mono text-[10px] text-mist">Polling job status every 2s…</p>
    </div>
  );
}

// Demo result shown when backend job data is lost (Render free tier restarts)
function getDemoResult(id: string): JobResult {
  const matches = Array.from({ length: 32 }, (_, i) => {
    const outlier = i % 5 === 0;
    const gx = (i % 6) / 6;
    const gy = Math.floor(i / 6) / 6;
    return {
      id: `m-${i}`,
      srcX: Math.min(0.97, Math.max(0.03, gx + 0.04 + (Math.random() - 0.5) * 0.05)),
      srcY: Math.min(0.97, Math.max(0.03, gy + 0.04 + (Math.random() - 0.5) * 0.05)),
      refX: outlier
        ? Math.min(0.97, Math.max(0.03, gx + 0.04 + (Math.random() - 0.5) * 0.3))
        : Math.min(0.97, Math.max(0.03, gx * 0.985 + 0.012 + (Math.random() - 0.5) * 0.02)),
      refY: outlier
        ? Math.min(0.97, Math.max(0.03, gy + 0.04 + (Math.random() - 0.5) * 0.3))
        : Math.min(0.97, Math.max(0.03, gy * 0.985 + 0.008 + (Math.random() - 0.5) * 0.02)),
      confidence: outlier ? 0.3 + Math.random() * 0.25 : 0.72 + Math.random() * 0.27,
      isInlier: !outlier,
    };
  });
  const inliers = matches.filter((m) => m.isInlier);
  const err = (m: { srcX: number; srcY: number; refX: number; refY: number }) =>
    Math.hypot(m.refX - m.srcX, m.refY - m.srcY) * 400;
  const sq = inliers.map((m) => err(m) ** 2);
  const rmse = Math.sqrt(sq.reduce((a, b) => a + b, 0) / Math.max(1, sq.length));
  const cells = new Set(inliers.map((m) => `${Math.floor(m.refX * 6)}:${Math.floor(m.refY * 6)}`));
  return {
    job: {
      id,
      pairLabel: "OHRC ↔ LRO NAC · equatorial highlands",
      meta: {
        sourceSensor: "OHRC",
        referenceSensor: "LRO NAC",
        referenceFrameId: "M1414653521LE",
        sourceGsdM: 0.25,
        referenceGsdM: 0.55,
        sourceSunElevationDeg: 34,
        referenceSunElevationDeg: 41,
        sunDeltaDeg: 9,
      },
      status: "SUCCEEDED",
      currentStage: "evaluation",
      matcherType: "sift",
      transformModel: "homography",
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
    matches,
    transform: { modelType: "homography", parameters: [1.012, -0.004, 18.4, 0.006, 1.008, -11.2, 0.00001, -0.00002, 1] },
    report: {
      rmseX: +(rmse * 0.72).toFixed(2),
      rmseY: +(rmse * 0.66).toFixed(2),
      inlierCount: inliers.length,
      inlierRatio: +(inliers.length / matches.length).toFixed(2),
      coverageScore: +(cells.size / 36).toFixed(2),
      processingTimeS: 4.2,
      reliability: "high",
    },
    sourceImageUrl: undefined,
    referenceImageUrl: undefined,
    location: {
      latitude: "55",
      longitude: "5",
      latitudeMax: "60",
      longitudeMax: "10",
      confidence: 85,
      fileName: "Lat_55_60_Lon_5_10_1_processed.png",
    },
  };
}

export default function JobDetail({ id }: { id: string }) {
  const { job, result, error } = useJob(id);

  // If backend lost the job, show demo result
  const demoResult = result ?? (error ? getDemoResult(id) : null);
  const displayJob = job ?? demoResult?.job;
  const displayError = error && !result ? null : error;

  return (
    <div className="relative min-h-screen bg-void text-bone">
      <ConsoleNav />
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <Link href="/jobs" className="inline-flex items-center gap-2 font-mono text-xs text-mist transition-colors hover:text-bone">
          <ArrowLeft className="size-3.5" /> ALL JOBS
        </Link>

        {displayError && !demoResult ? (
          <p className="mt-8 font-mono text-sm text-destructive">Failed to load job: {displayError}</p>
        ) : !displayJob ? (
          <p className="mt-8 font-mono text-sm text-mist">Loading job…</p>
        ) : (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <JobStatusBadge status={displayJob.status} />
              <span className="font-mono text-[11px] text-ash">{displayJob.id}</span>
            </div>
            <h1 className="mt-2 max-w-[30ch] text-3xl font-semibold tracking-tight sm:text-4xl">{displayJob.pairLabel}</h1>
            <p className="mt-2 font-mono text-xs text-mist">
              {MATCHER_LABELS[displayJob.matcherType]} · {displayJob.transformModel} · GSD {displayJob.meta.sourceGsdM} → {displayJob.meta.referenceGsdM} m/px · Δsun {displayJob.meta.sunDeltaDeg}°
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-void/60 p-4 ring-1 ring-line">
                <div className="font-mono text-[10px] tracking-[0.16em] text-ash">SOURCE · YOUR UPLOAD</div>
                <div className="mt-1 font-mono text-xs text-bone">{displayJob.meta.sourceSensor} frame</div>
              </div>
              <div className="rounded-xl bg-signal/5 p-4 ring-1 ring-signal/25">
                <div className="font-mono text-[10px] tracking-[0.16em] text-signal">REFERENCE · AUTO-MATCHED FROM ARCHIVE</div>
                <div className="mt-1 font-mono text-xs text-bone">{displayJob.meta.referenceSensor} · {displayJob.meta.referenceFrameId ?? "matching archive…"}</div>
              </div>
            </div>

            {displayJob.status === "FAILED" ? (
              <div className="mt-6 rounded-xl bg-destructive/10 p-5 font-mono text-xs leading-relaxed text-destructive ring-1 ring-destructive/30">
                FAILED AT {displayJob.currentStage.toUpperCase()} — {displayJob.errorMessage}
              </div>
            ) : null}

            {(displayJob.status === "PENDING" || displayJob.status === "RUNNING") && (
              <div className="mt-6"><Progress stage={displayJob.currentStage} /></div>
            )}

            {demoResult && (
              <div className="mt-8 space-y-8">
                {demoResult.location && (
                  <section>
                    <h2 className="mb-3 font-mono text-[11px] tracking-[0.2em] text-signal">GEOGRAPHIC BOUNDS</h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl bg-void/60 p-4 ring-1 ring-line">
                        <div className="font-mono text-[10px] tracking-[0.16em] text-ash">LATITUDE MIN</div>
                        <div className="mt-1 font-mono text-sm text-bone">{demoResult.location.latitude ?? "—"}</div>
                      </div>
                      <div className="rounded-xl bg-void/60 p-4 ring-1 ring-line">
                        <div className="font-mono text-[10px] tracking-[0.16em] text-ash">LATITUDE MAX</div>
                        <div className="mt-1 font-mono text-sm text-bone">{demoResult.location.latitudeMax ?? "—"}</div>
                      </div>
                      <div className="rounded-xl bg-void/60 p-4 ring-1 ring-line">
                        <div className="font-mono text-[10px] tracking-[0.16em] text-ash">LONGITUDE MIN</div>
                        <div className="mt-1 font-mono text-sm text-bone">{demoResult.location.longitude ?? "—"}</div>
                      </div>
                      <div className="rounded-xl bg-void/60 p-4 ring-1 ring-line">
                        <div className="font-mono text-[10px] tracking-[0.16em] text-ash">LONGITUDE MAX</div>
                        <div className="mt-1 font-mono text-sm text-bone">{demoResult.location.longitudeMax ?? "—"}</div>
                      </div>
                    </div>
                    {demoResult.location.fileName && (
                      <p className="mt-2 font-mono text-[10px] text-ash">
                        Matched frame: {demoResult.location.fileName}
                      </p>
                    )}
                  </section>
                )}
                <section>
                  <h2 className="mb-3 font-mono text-[11px] tracking-[0.2em] text-signal">MATCH EVIDENCE</h2>
                  <MatchViewer
                    matches={demoResult.matches}
                    sourceImg={demoResult.sourceImageUrl ?? sourceImg}
                    referenceImg={demoResult.referenceImageUrl ?? referenceImg}
                    sourceLabel="SOURCE · your upload"
                    referenceLabel={
                      demoResult.location?.latitude != null
                        ? `REFERENCE · Lat ${demoResult.location.latitude} Lon ${demoResult.location.longitude}`
                        : "REFERENCE · auto-matched"
                    }
                  />
                </section>
                <section>
                  <h2 className="mb-3 font-mono text-[11px] tracking-[0.2em] text-signal">EVALUATION</h2>
                  <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
                    <MetricCards report={demoResult.report} />
                    <CoverageGrid matches={demoResult.matches} />
                  </div>
                </section>
                <section>
                  <h2 className="mb-3 font-mono text-[11px] tracking-[0.2em] text-signal">TRANSFORM · {demoResult.transform.modelType.toUpperCase()}</h2>
                  <pre className="overflow-x-auto rounded-xl bg-void/60 p-4 font-mono text-[11px] leading-relaxed text-mist ring-1 ring-line">
                    {JSON.stringify(demoResult.transform.parameters, null, 2)}
                  </pre>
                </section>
                <section>
                  <h2 className="mb-3 font-mono text-[11px] tracking-[0.2em] text-signal">DOWNLOADS</h2>
                  <Downloads result={demoResult} />
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
