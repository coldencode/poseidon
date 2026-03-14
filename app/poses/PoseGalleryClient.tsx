"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Pose = {
  id: string;
  title: string;
  image: string;
};

type PoseGalleryClientProps = {
  poses: Pose[];
};

export default function PoseGalleryClient({ poses }: PoseGalleryClientProps) {
  const router = useRouter();
  const [selectedPose, setSelectedPose] = useState<Pose | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-sky-50 text-slate-900">
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.24em] text-sky-600 uppercase">POSEIDON FEED</p>
            <h1 className="mt-1 text-xl font-semibold">Choose your pose</h1>
          </div>
          <Link href="/" className="text-xs text-slate-500 underline underline-offset-4">
            Back
          </Link>
        </div>

        {poses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            No pose JSON files found in `public/pose-library`.
          </div>
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [column-fill:_balance]">
            {poses.map((pose) => (
              <button
                key={pose.id}
                type="button"
                onClick={() => setSelectedPose(pose)}
                className="mb-3 w-full break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <Image
                  src={pose.image}
                  alt={pose.title}
                  width={360}
                  height={560}
                  className="h-auto w-full object-cover"
                />
                <div className="px-3 py-2 text-sm font-medium text-slate-700">{pose.title}</div>
              </button>
            ))}
          </div>
        )}
      </main>

      {selectedPose ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <h2 className="text-base font-semibold">Confirm selection</h2>
            <p className="mt-2 text-sm text-slate-600">
              Open camera with <span className="font-semibold">{selectedPose.title}</span> as target overlay?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedPose(null)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push(`/camera?pose=${encodeURIComponent(selectedPose.id)}`);
                  setSelectedPose(null);
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-fuchsia-500 px-3 py-2 text-sm font-semibold text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
