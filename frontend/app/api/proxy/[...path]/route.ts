import { NextRequest, NextResponse } from "next/server";
import {
  JOB_FIXTURES,
  STAGES,
  type EvaluationReport,
  type Job,
  type JobFixture,
  type MatchPoint,
  type Transform,
} from "@/lib/mock-data";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// In-memory dummy store. Used for the landing/compare fixtures and as a
// fallback when the FastAPI process is not running.
let store: Map<string, JobFixture> | null = null;
const polls = new Map<string, number>();

function getStore(): Map<string, JobFixture> {
  if (!store) {
    store = new Map(
      JOB_FIXTURES.map((f) => [f.job.id, JSON.parse(JSON.stringify(f)) as JobFixture]),
    );
  }
  return store;
}

function advance(job: Job): Job {
  if (job.status === "SUCCEEDED" || job.status === "FAILED") return job;
  const n = (polls.get(job.id) ?? 0) + 1;
  polls.set(job.id, n);
  const needed = job.pollsNeeded ?? 6;
  if (job.status === "PENDING" && n >= 1) {
    job.status = "RUNNING";
    job.startedAt = new Date().toISOString();
  }
  if (job.status === "RUNNING") {
    const idx = Math.min(STAGES.length - 1, Math.floor(((n - 1) / needed) * STAGES.length));
    job.currentStage = STAGES[idx];
    if (n >= needed + 1) {
      job.status = "SUCCEEDED";
      job.currentStage = "evaluation";
      job.completedAt = new Date().toISOString();
    }
  }
  return job;
}

async function backendFetch(path: string, init?: RequestInit) {
  return fetch(`${BACKEND}${path}`, { cache: "no-store", ...init });
}

function dummyGet(segments: string[]) {
  const s = getStore();
  if (segments.length === 1 && segments[0] === "jobs") {
    return NextResponse.json({ jobs: [...s.values()].map((f) => f.job) });
  }
  if (segments.length === 2 && segments[0] === "jobs") {
    const f = s.get(segments[1]);
    if (!f) return NextResponse.json({ error: "job not found" }, { status: 404 });
    return NextResponse.json({ job: advance(f.job) });
  }
  if (segments.length === 3 && segments[0] === "jobs") {
    const f = s.get(segments[1]);
    if (!f) return NextResponse.json({ error: "job not found" }, { status: 404 });
    const kind = segments[2];
    if (kind === "result")
      return NextResponse.json({
        job: f.job,
        matches: f.matches,
        transform: f.transform,
        report: f.report,
      });
    if (kind === "matches") return NextResponse.json({ matches: f.matches });
    if (kind === "report") return NextResponse.json({ report: f.report });
  }
  return NextResponse.json({ error: "unknown endpoint" }, { status: 404 });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const segments = (await ctx.params).path ?? [];
  const path = `/${segments.join("/")}`;

  try {
    const res = await backendFetch(path);
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("image/")) {
        return new NextResponse(res.body, {
          status: 200,
          headers: { "Content-Type": contentType },
        });
      }
      const data = (await res.json()) as Record<string, unknown>;
      if (segments.length === 1 && segments[0] === "jobs") {
        const backendJobs = (data.jobs as Job[]) ?? [];
        const ids = new Set(backendJobs.map((j) => j.id));
        const fixtures = [...getStore().values()].map((f) => f.job).filter((j) => !ids.has(j.id));
        return NextResponse.json({ jobs: [...backendJobs, ...fixtures] });
      }
      return NextResponse.json(data);
    }
  } catch {
    // FastAPI not running — serve the dummy console fixtures.
  }

  return dummyGet(segments);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const segments = (await ctx.params).path ?? [];
  if (segments.length !== 1 || (segments[0] !== "jobs" && segments[0] !== "match")) {
    return NextResponse.json({ error: "unknown endpoint" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") || "";
  try {
    const init: RequestInit = { method: "POST" };
    if (contentType.includes("multipart/form-data")) {
      init.body = await req.formData();
    } else {
      init.headers = { "Content-Type": "application/json" };
      init.body = await req.text();
    }
    const backendPath = segments[0] === "match" ? "/match" : "/jobs";
    const res = await backendFetch(backendPath, init);
    const data = await res.json().catch(() => ({ error: "backend error" }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    if (contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "FastAPI backend is not running on port 8000. Start it with: uvicorn app.main:app --port 8000" },
        { status: 503 },
      );
    }
  }

  let pairLabel = "OHRC ↔ LRO NAC · new upload";
  let matcherType: Job["matcherType"] = "superpoint-superglue";
  let transformModel: Job["transformModel"] = "homography";
  if (contentType.includes("multipart/form-data")) {
    // Body already consumed if backend fetch ran; dummy path only hits when
    // FastAPI is down and FormData was not forwarded. Recreate from clone is
    // not possible — keep generic labels.
  } else {
    const body = (await req.json().catch(() => ({}))) as Partial<Job> & {
      matches?: MatchPoint[];
      transform?: Transform;
      report?: EvaluationReport;
    };
    pairLabel = body.pairLabel ?? pairLabel;
    matcherType = body.matcherType ?? matcherType;
    transformModel = body.transformModel ?? transformModel;
  }

  const id = `job-${Date.now().toString(36)}`;
  const fixture: JobFixture = {
    job: {
      id,
      pairLabel,
      meta: {
        sourceSensor: "OHRC",
        referenceSensor: "LRO NAC",
        referenceFrameId: "M1414653521LE",
        sourceGsdM: 0.25,
        referenceGsdM: 0.6,
        sourceSunElevationDeg: 30,
        referenceSunElevationDeg: 36,
        sunDeltaDeg: 6,
      },
      status: "PENDING",
      currentStage: "queued",
      matcherType,
      transformModel,
      createdAt: new Date().toISOString(),
      pollsNeeded: 7,
    },
    matches: [],
    transform: { modelType: "homography", parameters: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
    report: {
      rmseX: 0.62, rmseY: 0.57, inlierCount: 27, inlierRatio: 0.84,
      coverageScore: 0.78, processingTimeS: 4.6, reliability: "high",
    },
  };
  if (fixture.matches.length === 0) {
    const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const { JOB_FIXTURES: base } = await import("@/lib/mock-data");
    fixture.matches = JSON.parse(JSON.stringify(base[0].matches)) as MatchPoint[];
    fixture.matches.forEach((m, i) => {
      m.id = `m-${seed}-${i}`;
    });
  }
  const s = getStore();
  store = new Map<string, JobFixture>([[id, fixture], ...s]);
  polls.set(id, 0);
  return NextResponse.json({ jobId: id, job: fixture.job }, { status: 201 });
}

export type { Job, JobFixture };
