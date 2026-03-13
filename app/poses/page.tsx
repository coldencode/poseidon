"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Pose = {
  id: number;
  title: string;
  image: string;
};

const POSES: Pose[] = [
  { id: 1, title: "Power Stance", image: "/poses/pose-1.svg" },
  { id: 2, title: "Over Shoulder", image: "/poses/pose-2.svg" },
  { id: 3, title: "Walking Shot", image: "/poses/pose-3.svg" },
  { id: 4, title: "Mirror Lean", image: "/poses/pose-4.svg" },
  { id: 5, title: "Street Sit", image: "/poses/pose-5.svg" },
  { id: 6, title: "Wall Focus", image: "/poses/pose-6.svg" },
  { id: 7, title: "Relaxed Arms", image: "/poses/pose-7.svg" },
  { id: 8, title: "Profile Turn", image: "/poses/pose-8.svg" },
];

export default function PosesPage() {
  const router = useRouter();
  const [selectedPose, setSelectedPose] = useState<Pose | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-sky-50 px-4 py-6 text-slate-900">
      <main className="mx-auto flex h-[calc(100dvh-3rem)] w-full max-w-sm flex-col rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="mb-4 flex items-start justify-between gap-3 px-1">
          <div>
            <p className="text-xs tracking-[0.24em] text-sky-600 uppercase">POSEIDON FEED</p>
            <h1 className="mt-1 text-xl font-semibold">Choose your pose</h1>
          </div>
          <Link href="/" className="text-xs text-slate-500 underline underline-offset-4">
            Back
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 scroll-smooth">
          <div className="columns-2 gap-3 [column-fill:_balance]">
          {POSES.map((pose) => (
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
        </div>
      </main>

      {selectedPose ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <h2 className="text-base font-semibold">Confirm selection</h2>
            <p className="mt-2 text-sm text-slate-600">
              Open camera now for live landmark detection only?
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
                  router.push("/camera");
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
