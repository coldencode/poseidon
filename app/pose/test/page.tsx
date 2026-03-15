"use client";

import { useState } from "react";
import { imageToPose } from "@/src/lib/imageToPose";
import PoseSkeletonCanvas from "@/src/components/pose-skeleton/PoseSkeletonCanvas";

const POSE_IMAGES = [
  "/pose-library/pose1.png",
  "/pose-library/pose2.png",
 
  "/pose-library/pose9.png",
];


export default function PoseTestPage() {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [poseData, setPoseData] = useState<{
    landmarks: unknown[][];
    worldLandmarks: unknown[][];
    hasPose: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDetection = async (imagePath: string) => {
    setCurrentImage(imagePath);
    setLoading(true);
    setError(null);
    setPoseData(null);
    try {
      const data = await imageToPose(imagePath);
      setPoseData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-xl font-semibold text-white">
          Pose image test
        </h1>
        <div className="mb-4 flex flex-wrap gap-2">
          {POSE_IMAGES.map((path) => (
            <button
              key={path}
              onClick={() => runDetection(path)}
              disabled={loading}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {path.split("/").pop()}
            </button>
          ))}
        </div>
        {currentImage && (
          <div className="mb-4 overflow-hidden rounded-lg border border-slate-700">
            <PoseSkeletonCanvas
              imageSrc={currentImage}
              landmarks={poseData?.landmarks ?? null}
              className="w-full max-w-xs"
            />
            <p className="bg-slate-900 px-3 py-2 text-xs text-slate-400">
              {currentImage.split("/").pop()}
            </p>
          </div>
        )}
        {loading && (
          <p className="mb-2 text-sm text-slate-400">Loading model & detecting…</p>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {poseData && (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
            <p className="mb-2 text-xs font-medium text-slate-400">Result</p>
            <pre className="max-h-96 overflow-auto text-xs text-slate-300">
              {JSON.stringify(poseData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
