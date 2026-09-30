// Typed fetch wrapper around /api/proxy (dummy backend today, FastAPI tomorrow).
import type {
  EvaluationReport,
  Job,
  JobResult,
  MatcherType,
  MatchPoint,
  TransformModel,
} from "@/lib/mock-data";

export type { EvaluationReport, Job, JobResult, MatcherType, MatchPoint, TransformModel };

const BASE = "/api/proxy";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: unknown };
    const detail = Array.isArray(body.detail) ? JSON.stringify(body.detail) : body.detail;
    throw new Error((typeof detail === "string" && detail) || body.error || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function listJobs() {
  return fetch(`${BASE}/jobs`).then((r) => json<{ jobs: Job[] }>(r));
}

export function getJob(id: string) {
  return fetch(`${BASE}/jobs/${id}`).then((r) => json<{ job: Job }>(r));
}

export function getResult(id: string) {
  return fetch(`${BASE}/jobs/${id}/result`).then((r) => json<JobResult>(r));
}

export function localizeImage(file: File) {
  const body = new FormData();
  body.append("file", file);
  return fetch(`${BASE}/match`, {
    method: "POST",
    body,
  }).then((r) => json<{
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
  }>(r));
}

export function getMatches(id: string) {
  return fetch(`${BASE}/jobs/${id}/matches`).then((r) => json<{ matches: MatchPoint[] }>(r));
}

export function getReport(id: string) {
  return fetch(`${BASE}/jobs/${id}/report`).then((r) => json<{ report: EvaluationReport }>(r));
}

export function createJob(input: {
  pairLabel: string;
  matcherType: MatcherType;
  transformModel: TransformModel;
  file?: File | null;
  sourceSensor?: string;
  referenceSensor?: string;
}) {
  const body = new FormData();
  body.append("pairLabel", input.pairLabel);
  body.append("matcherType", input.matcherType);
  body.append("transformModel", input.transformModel);
  if (input.sourceSensor) body.append("sourceSensor", input.sourceSensor);
  if (input.referenceSensor) body.append("referenceSensor", input.referenceSensor);
  if (input.file) body.append("file", input.file);

  return fetch(`${BASE}/jobs`, {
    method: "POST",
    body,
  }).then((r) => json<{ jobId: string; job: Job }>(r));
}
