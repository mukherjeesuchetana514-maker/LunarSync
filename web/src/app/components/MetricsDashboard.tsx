'use client';

import { useMatchStore } from '@/app/store/useMatchStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function MetricsDashboard() {
  const activeMetrics = useMatchStore((state) => state.activeMetrics);

  if (!activeMetrics) return null;

  const chartData = [
    { name: 'Match %', value: activeMetrics.match_percentage },
    { name: 'Correct Match Rate', value: activeMetrics.correct_match_rate },
    { name: 'Inlier Ratio', value: activeMetrics.inlier_ratio },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-xl">
        <h2 className="text-lg font-bold text-blue-400 mb-4 border-b border-slate-800 pb-2">
          📍 Target Spatial Location Located
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <span className="text-slate-400 block text-xs">Extracted Latitude</span>
            <span className="text-xl font-bold text-emerald-400">{activeMetrics.latitude}</span>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <span className="text-slate-400 block text-xs">Extracted Longitude</span>
            <span className="text-xl font-bold text-emerald-400">{activeMetrics.longitude}</span>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <span className="text-slate-400 block text-xs">Confidence Score</span>
            <span className="text-xl font-bold text-blue-400">{activeMetrics.match_percentage}%</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-xl">
        <h3 className="text-md font-bold mb-4 text-slate-200">Registration Accuracy Profile</h3>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}