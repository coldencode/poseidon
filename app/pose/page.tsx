"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import PoseCamera from "@/src/components/pose-camera/PoseCamera";
import { NormalizedLandmark } from "@mediapipe/tasks-vision";

type PoseLibraryItem = {
  id: string;
  image: string;
  landmarks: NormalizedLandmark[][];
};

const POSE_IDS = ["pose1", "pose2"];
const POSE_REDUCTION_KEEP: [number, string][] = [
  [0, "nose"],
  [7, "left_wrist"],
  [8, "right_wrist"],
  [11, "left_hip"],
  [12, "right_hip"],
  [13, "left_knee"],
  [14, "right_knee"],
  [15, "left_ankle"],
  [16, "right_ankle"],
  [19, "left_thumb"],
  [20, "right_thumb"],
  [23, "left_elbow"],
  [24, "right_elbow"],
  [25, "left_shoulder"],
  [26, "right_shoulder"],
  [27, "left_heel"],
  [28, "right_heel"],
  [31, "left_foot_index"],
  [32, "right_foot_index"]];

function getLandmarksForApi(landmarks: NormalizedLandmark[][] | null): string {
  if (!landmarks) return "";
  const arr = Array.isArray(landmarks) ? landmarks : [landmarks];
  const firstPose: NormalizedLandmark[] = Array.isArray(arr[0])
    ? arr[0]
    : (arr as unknown as NormalizedLandmark[]);

  const reducedLandmarks = firstPose
    .filter((_, idx) => POSE_REDUCTION_KEEP.some(([keepIdx]) => keepIdx === idx))
    .map((lm, i) => ([
      lm.x.toFixed(5),
      lm.y.toFixed(5),
      lm.z.toFixed(5),
      lm.visibility.toFixed(5),
    ]));
  return JSON.stringify(reducedLandmarks);
}

export default function PosePage() {
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[][] | null>(
    null,
  );
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [poseLibrary, setPoseLibrary] = useState<PoseLibraryItem[]>([]);
  const [selectedPose, setSelectedPose] = useState<PoseLibraryItem | null>(
    null,
  );
  const [llmResponse, setLlmResponse] = useState<string | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPoseLibrary() {
      const items: PoseLibraryItem[] = [];
      for (const id of POSE_IDS) {
        try {
          const res = await fetch(`/pose-library/${id}.json`);
          const data = await res.json();
          items.push({
            id,
            image: `/pose-library/${data.pose}`,
            landmarks: data.landmarks ?? [],
          });
        } catch {
          console.warn(`Failed to load ${id}.json`);
        }
      }
      setPoseLibrary(items);
    }
    loadPoseLibrary();
  }, []);

  const handleSend = async () => {
    const userSkeleton = getLandmarksForApi(landmarks);
    const chosenSkeleton = selectedPose
      ? getLandmarksForApi(selectedPose.landmarks)
      : "";

    if (!userSkeleton || !chosenSkeleton) {
      setLlmError(
        "Need both a current pose and a selected pose from the library.",
      );
      return;
    }

    setLlmLoading(true);
    setLlmError(null);
    setLlmResponse(null);

    try {
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_skeleton: userSkeleton,
          chosen_skeleton: chosenSkeleton,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Request failed");
      }
      setLlmResponse(data.response ?? "");
    } catch (err) {
      setLlmError(err instanceof Error ? err.message : String(err));
    } finally {
      setLlmLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-950 p-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row">
        {/* Left: Camera + current pose */}
        <div className="flex-1">
          <h1 className="mb-4 text-xl font-semibold text-white">Pose</h1>
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
              <p className="text-xs font-medium text-slate-400">Current pose</p>
              {lastUpdate !== null && (
                <p className="text-xs text-slate-500">
                  Updated {new Date(lastUpdate).toLocaleTimeString()}
                </p>
              )}
            </div>
            <pre className="max-h-32 overflow-auto text-xs text-slate-300">
              {landmarks
                ? JSON.stringify(landmarks, null, 2).slice(0, 500) + "..."
                : "No pose data yet"}
            </pre>
          </div>
        </div>

        {/* Right: Pose library column */}
        <div className="w-full shrink-0 lg:w-64">
          <h2 className="mb-3 text-sm font-semibold text-white">
            Pose library
          </h2>
          <div className="flex flex-col gap-2">
            {poseLibrary.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedPose(item)}
                className={`relative overflow-hidden rounded-lg border-2 transition ${
                  selectedPose?.id === item.id
                    ? "border-cyan-500 ring-2 ring-cyan-500/30"
                    : "border-slate-700 hover:border-slate-500"
                }`}
              >
                <div className="relative aspect-[3/4] w-full">
                  <Image
                    src={item.image}
                    alt={item.id}
                    fill
                    className="object-cover"
                    sizes="256px"
                  />
                </div>
                <p className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 text-center text-xs text-white">
                  {item.id}
                </p>
              </button>
            ))}
          </div>

          <button
            onClick={handleSend}
            disabled={llmLoading || !selectedPose || !landmarks}
            className="mt-4 w-full rounded-lg bg-cyan-600 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600"
          >
            {llmLoading ? "Sending…" : "Send"}
          </button>

          {llmResponse && (
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-3">
              <p className="mb-1 text-xs font-medium text-slate-400">Output</p>
              <p className="text-sm text-white">{llmResponse}</p>
            </div>
          )}
          {llmError && (
            <div className="mt-4 rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-300">
              {llmError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
