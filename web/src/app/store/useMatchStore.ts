import { create } from 'zustand';
import { MatchMetrics } from '@/app/lib/api';

interface MatchStore {
  activeMetrics: MatchMetrics | null;
  setActiveMetrics: (metrics: MatchMetrics | null) => void;
  reset: () => void;
}

export const useMatchStore = create<MatchStore>((set) => ({
  activeMetrics: null,
  setActiveMetrics: (metrics) => set({ activeMetrics: metrics }),
  reset: () => set({ activeMetrics: null }),
}));