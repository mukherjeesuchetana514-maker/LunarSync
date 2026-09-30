"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, MapPin, Cpu, Target, Crosshair, CheckCircle2, XCircle } from "lucide-react";
import { localizeImage } from "@/lib/api-client";
import { ConsoleNav } from "@/components/ConsoleNav";

type MatchResult = {
  status: string;
  result?: {
    latitude: string;
    longitude: string;
    match_percentage: number;
    correct_match_rate: number;
    rmse: number;
    inlier_count: number;
    inlier_ratio: number;
    precision_recall_f1: string;
    runtime: number;
    file_name: string;
  };
  message?: string;
};

export default function LocalizePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (f: File | null) => {
    setFile(f);
    setResult(null);
    setError(null);
    if (f) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await localizeImage(file);
      setResult(res);
      if (res.status === "failure") {
        setError(res.message || "Matching failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-void text-bone">
      <ConsoleNav />
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <button
          type="button"
          onClick={() => router.push("/jobs")}
          className="inline-flex items-center gap-2 font-mono text-xs text-mist transition-colors hover:text-bone"
        >
          <ArrowLeft className="size-3.5" /> ALL JOBS
        </button>

        <p className="mt-4 font-mono text-[11px] tracking-[0.2em] text-signal">LUNARSYNC — BLIND IMAGE LOCALIZATION</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Localize Lunar Image</h1>
        <p className="mt-2 max-w-[64ch] text-sm text-mist">
          Upload a Chandrayaan-2 frame and the hybrid CNN+SIFT engine will match it against the lunar archive,
          reject outliers with MAGSAC, and return the geographic coordinates of the matched region.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Upload Section */}
          <div className="space-y-4">
            <label className="block cursor-pointer rounded-xl border border-dashed border-line p-8 text-center transition-colors hover:border-signal/60 hover:bg-signal/5">
              <span className="mb-2 block font-mono text-[10px] tracking-[0.16em] text-ash">QUERY IMAGE · UPLOAD</span>
              {preview ? (
                <img src={preview} alt="Preview" className="mx-auto max-h-48 rounded-lg" />
              ) : (
                <span className="block font-mono text-xs text-bone">Drop your lunar image here or click to browse</span>
              )}
              <span className="mt-2 block font-mono text-[10px] text-ash">PNG · JPG · TIFF · BMP</span>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.tif,.tiff,.bmp"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={busy || !file}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-md bg-signal px-5 py-3 font-mono text-sm font-semibold text-void ring-1 ring-signal/40 transition-colors hover:bg-bone disabled:opacity-50"
            >
              {busy ? "MATCHING…" : "Localize Image"}
              <Crosshair className="size-4 transition-transform group-hover:rotate-90" />
            </button>

            {error && (
              <div className="rounded-xl bg-destructive/10 p-4 font-mono text-xs leading-relaxed text-destructive ring-1 ring-destructive/30">
                {error}
              </div>
            )}

            {/* Pipeline Info */}
            <div className="rounded-xl bg-void/60 p-4 ring-1 ring-line">
              <div className="font-mono text-[10px] tracking-[0.16em] text-ash">PIPELINE STAGES</div>
              <ol className="mt-3 space-y-2">
                {[
                  "CNN Global Screening (ResNet50)",
                  "SIFT Feature Extraction",
                  "RootSIFT Matching",
                  "MAGSAC Outlier Rejection",
                  "Subpixel Refinement",
                  "Geographic Coordinate Extraction",
                ].map((stage, i) => (
                  <li key={stage} className="flex items-center gap-2 font-mono text-[11px] text-mist">
                    <span className="flex size-5 items-center justify-center rounded-full bg-signal/10 text-[10px] text-signal">
                      {i + 1}
                    </span>
                    {stage}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            {result?.status === "success" && result.result ? (
              <>
                <div className="rounded-xl bg-signal/5 p-5 ring-1 ring-signal/25">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-signal" />
                    <span className="font-mono text-xs tracking-[0.18em] text-signal">MATCH SUCCESSFUL</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-void/60 p-3">
                      <div className="font-mono text-[10px] tracking-[0.14em] text-ash">LATITUDE</div>
                      <div className="mt-1 font-mono text-sm text-bone">{result.result.latitude}°</div>
                    </div>
                    <div className="rounded-lg bg-void/60 p-3">
                      <div className="font-mono text-[10px] tracking-[0.14em] text-ash">LONGITUDE</div>
                      <div className="mt-1 font-mono text-sm text-bone">{result.result.longitude}°</div>
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-[10px] text-ash">
                    Matched frame: {result.result.file_name}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-void/60 p-4 ring-1 ring-line">
                    <div className="flex items-center gap-2">
                      <Target className="size-3.5 text-signal" />
                      <span className="font-mono text-[10px] tracking-[0.14em] text-ash">CONFIDENCE</span>
                    </div>
                    <div className="mt-2 font-mono text-2xl font-semibold text-bone">
                      {result.result.match_percentage.toFixed(1)}%
                    </div>
                  </div>
                  <div className="rounded-xl bg-void/60 p-4 ring-1 ring-line">
                    <div className="flex items-center gap-2">
                      <Cpu className="size-3.5 text-signal" />
                      <span className="font-mono text-[10px] tracking-[0.14em] text-ash">RMSE</span>
                    </div>
                    <div className="mt-2 font-mono text-2xl font-semibold text-bone">
                      {result.result.rmse.toFixed(3)} px
                    </div>
                  </div>
                  <div className="rounded-xl bg-void/60 p-4 ring-1 ring-line">
                    <div className="font-mono text-[10px] tracking-[0.14em] text-ash">INLIERS</div>
                    <div className="mt-2 font-mono text-2xl font-semibold text-bone">
                      {result.result.inlier_count}
                    </div>
                  </div>
                  <div className="rounded-xl bg-void/60 p-4 ring-1 ring-line">
                    <div className="font-mono text-[10px] tracking-[0.14em] text-ash">RUNTIME</div>
                    <div className="mt-2 font-mono text-2xl font-semibold text-bone">
                      {result.result.runtime.toFixed(2)}s
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-void/60 p-4 ring-1 ring-line">
                  <div className="font-mono text-[10px] tracking-[0.14em] text-ash">DETAILED METRICS</div>
                  <div className="mt-2 space-y-1 font-mono text-[11px] text-mist">
                    <div className="flex justify-between">
                      <span>Correct Match Rate</span>
                      <span className="text-bone">{result.result.correct_match_rate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Inlier Ratio</span>
                      <span className="text-bone">{result.result.inlier_ratio}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Precision / Recall / F1</span>
                      <span className="text-bone">{result.result.precision_recall_f1}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : result?.status === "failure" ? (
              <div className="rounded-xl bg-destructive/10 p-5 ring-1 ring-destructive/30">
                <div className="flex items-center gap-2">
                  <XCircle className="size-4 text-destructive" />
                  <span className="font-mono text-xs tracking-[0.18em] text-destructive">MATCHING FAILED</span>
                </div>
                <p className="mt-3 font-mono text-xs leading-relaxed text-destructive">
                  {result.message || "The engine could not find a reliable match for this image."}
                </p>
              </div>
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl bg-void/60 p-8 ring-1 ring-line">
                <div className="text-center">
                  <MapPin className="mx-auto size-8 text-ash" />
                  <p className="mt-3 font-mono text-xs text-ash">
                    Upload an image and click &quot;Localize Image&quot; to see results
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
