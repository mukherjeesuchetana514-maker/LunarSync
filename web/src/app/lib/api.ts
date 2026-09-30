export interface MatchMetrics {
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
}

export interface MatchAPIResponse {
  status: 'success' | 'failure';
  result?: MatchMetrics;
  message?: string;
}

export async function uploadLunarImage(file: File): Promise<MatchAPIResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('http://127.0.0.1:8000/match', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}`);
  }

  return response.json();
}