"use client";

import { useRouter } from "next/navigation";
import SkeletonViewer from "./skeletonViewer";

import { PoseLandmarker } from "@mediapipe/tasks-vision";
import { Pose } from "../types";

export default function Results({
  pose,
  referencePose,
  photo,
  referencePhoto,
}: {
  pose: Pose;
  referencePose: Pose;
  photo: string;
  referencePhoto: string;
}) {
  const router = useRouter();
  return (
    <div
      className="min-h-screen min-h-[100dvh] bg-slate-950
                    px-4 md:px-8 pb-[env(safe-area-inset-bottom)]
                    pt-[env(safe-area-inset-top)]"
    >
      <div
        className="mx-auto md:mx-80 flex flex-col justify-center
                      min-h-[100dvh]"
      >
        <div className="flex flex-col md:flex-row gap-2 ">
          {/* left col */}
          <div className="flex flex-1 flex-col gap-2 md:h-[600px] h-160">
            <div
              className="flex-1  rounded-lg border border-slate-700 
                            bg-slate-900 p-4"
            >
              <SkeletonViewer
                pose={pose.worldLandmarks[0]}
                referencePose={referencePose.worldLandmarks[0]}
              />
            </div>
            <button
              className="rounded-lg border border-slate-700
                               bg-slate-900 p-2 text-sm text-slate-400
                               hover:border-slate-500 transition font-semibold"
              onClick={() => router.push("/pose")}
            >
              Try Again
            </button>
          </div>

          {/* right col */}
          <div className="flex flex-1 flex-col gap-2 h-150">
            <div
              className="flex-1 min-h-0 rounded-lg border border-slate-700
              bg-slate-900 p-4 relative overflow-hidden"
            >
              <img
                src={photo}
                alt="Reference pose"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div
              className="flex-1 min-h-0 rounded-lg border border-slate-700
              bg-slate-900 p-4 overflow-hidden"
            >
              <img
                src={referencePhoto}
                alt="Reference pose"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <button
              className="rounded-lg bg-cyan-600 p-2 text-sm
                               font-semibold text-white hover:bg-cyan-500
                               transition"
            >
              Save to library
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
