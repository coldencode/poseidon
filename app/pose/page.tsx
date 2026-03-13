"use client";

import { useState } from "react";
import PoseCamera from "@/src/components/pose-camera/PoseCamera";

export default function PosePage() {
  const [landmarks, setLandmarks] = useState<unknown>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-950 p-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-center text-xl font-semibold text-white">
          Pose
        </h1>
        <PoseCamera
          frameSize={{ width: 640, height: 480 }}
          showPoseStatus
          callbackIntervalMs={5000}
          onSkeletonUpdate={(snapshot) => {
            setLandmarks(snapshot.landmarks);
            setLastUpdate(Date.now());
          }}
        />
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400">Landmarks</p>
            {lastUpdate !== null && (
              <p className="text-xs text-slate-500">
                Updated {new Date(lastUpdate).toLocaleTimeString()}
              </p>
            )}
          </div>
          <pre className="max-h-40 overflow-auto text-xs text-slate-300">
            {landmarks
              ? JSON.stringify(landmarks, null, 2)
              : "No pose data yet"}
          </pre>
        </div>
      </div>
    </div>
  );
}
