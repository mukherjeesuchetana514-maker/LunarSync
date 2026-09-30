'use client';

import { useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadLunarImage } from '@/app/lib/api';
import { useMatchStore } from '@/app/store/useMatchStore';
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react';

export default function ImageUploader() {
  const setActiveMetrics = useMatchStore((state) => state.setActiveMetrics);

  const mutation = useMutation({
    mutationFn: (file: File) => uploadLunarImage(file),
    onSuccess: (data) => {
      if (data.status === 'success' && data.result) {
        setActiveMetrics(data.result);
      } else {
        alert(data.message || 'Matching failed. Try another frame.');
      }
    },
    onError: (error: Error) => {
      console.error('API Error:', error);
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        mutation.mutate(acceptedFiles[0]);
      }
    },
    [mutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.tif', '.tiff'] },
    multiple: false,
  });

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
          isDragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
        }`}
      >
        <input {...getInputProps()} />

        {mutation.isPending ? (
          <div className="flex flex-col items-center gap-2 text-blue-400">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="font-medium text-sm">
              Executing LoFTR Deep Transformer Registration...
            </p>
          </div>
        ) : (
          <>
            <UploadCloud className="w-10 h-10 text-slate-400" />
            <div>
              <p className="text-slate-200 font-semibold text-base">
                Drag & drop Pushbroom / Lunar image strip
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports PNG, JPG, JPEG, TIF, TIFF
              </p>
            </div>
          </>
        )}
      </div>

      {mutation.isError && (
        <div className="mt-3 p-3 bg-red-950/40 border border-red-800/50 rounded-lg flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Error: {mutation.error.message}</span>
        </div>
      )}
    </div>
  );
}