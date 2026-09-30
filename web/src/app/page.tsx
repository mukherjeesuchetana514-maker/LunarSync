'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import ImageUploader from '@/app/components/ImageUploader';
import MetricsDashboard from '@/app/components/MetricsDashboard';

export default function Home() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <header className="max-w-4xl mx-auto text-center mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            LunaSync Registration Platform
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Deep Transformer (LoFTR) Anisotropic Registration Engine for Chandrayaan-2 Pushbroom Images
          </p>
        </header>

        <ImageUploader />
        <MetricsDashboard />
      </main>
    </QueryClientProvider>
  );
}