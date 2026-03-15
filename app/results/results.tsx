"use client";

import { useRouter, useSearchParams } from "next/navigation";
import SkeletonViewer from "./skeletonViewer";

import { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import { PHOTO_STORAGE_KEY, Pose } from "../types";
import Image, { StaticImageData } from "next/image";
import { useEffect, useState } from "react";
type PoseLibraryJson = {
  pose?: string;
  landmarks?: NormalizedLandmark[][];
  worldLandmarks?: NormalizedLandmark[][];
};

export default function Results({
  pose,
  referencePose,
  photo,
  referencePhoto,
}: {
  pose: Pose;
  referencePose: Pose;
  photo: StaticImageData;
  referencePhoto: StaticImageData;
}) {
  const handleSaveToLibrary = async () => {
    if (!photo) return;

    const response = await fetch(photo.src);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "photo.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };
  const router = useRouter();

  const searchParams = useSearchParams();
  const selectedPoseId = searchParams.get("pose");

  const [userPhotos, setUserPhotos] = useState<string[]>(() => {
    const savedPhotos = localStorage.getItem(PHOTO_STORAGE_KEY);
    if (!savedPhotos) {
      return [];
    }

    try {
      const parsed = JSON.parse(savedPhotos);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === "string");
      }
    } catch {
      localStorage.removeItem(PHOTO_STORAGE_KEY);
    }
    return [];
  });

  const [targetPoseLandmarks, setTargetPoseLandmarks] = useState<
    NormalizedLandmark[] | undefined
  >(undefined);
  const [targetPoseImage, setTargetPoseImage] = useState<string | null>(null);
  const [targetPoseLabel, setTargetPoseLabel] = useState<string | null>(null);
  const [poseMatchScore, setPoseMatchScore] = useState<number | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadTargetPose = async () => {
      if (!selectedPoseId) {
        setTargetPoseLandmarks(undefined);
        setTargetPoseImage(null);
        setTargetPoseLabel(null);
        return;
      }

      try {
        const response = await fetch(`/pose-library/${selectedPoseId}.json`);
        if (!response.ok) {
          throw new Error("Failed to load selected pose");
        }

        const parsed = (await response.json()) as PoseLibraryJson;
        console.log(parsed);
        const firstLandmarks = Array.isArray(parsed.landmarks)
          ? parsed.landmarks[0]
          : Array.isArray(parsed.worldLandmarks)
            ? parsed.worldLandmarks[0]
            : undefined;

        if (!isActive) {
          return;
        }

        setTargetPoseLandmarks(firstLandmarks);
        setTargetPoseImage(
          parsed.pose
            ? `/pose-library/${parsed.pose}`
            : `/pose-library/${selectedPoseId}.png`,
        );
        setTargetPoseLabel(selectedPoseId.replace(/[-_]+/g, " "));
      } catch {
        if (!isActive) {
          return;
        }
        setTargetPoseLandmarks(undefined);
        setTargetPoseImage(null);
        setTargetPoseLabel(null);
      }
    };

    loadTargetPose();

    return () => {
      isActive = false;
    };
  }, [selectedPoseId]);
  return (
    <div
      className="min-h-screen min-h-[100dvh] bg-slate-50
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
              className="flex-1 rounded-lg border border-slate-200
                            bg-white p-4 shadow-sm"
            >
              <SkeletonViewer
                pose={pose.worldLandmarks[0]}
                referencePose={referencePose.worldLandmarks[0]}
              />
            </div>
            <button
              className="rounded-lg border border-slate-300
                               bg-white p-2 text-sm text-slate-600
                               hover:border-slate-400 hover:bg-slate-50 transition font-semibold shadow-sm"
              onClick={() => router.push("/poses")}
            >
              Try Again
            </button>
          </div>

          {/* right col */}
          <div className="flex flex-1 flex-col gap-2 h-150">
            <div
              className="flex-1 min-h-0 rounded-lg border border-slate-200
              bg-white p-4 relative overflow-hidden shadow-sm"
            >
              <img
                src={photo.src}
                alt="Reference pose"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div
              className="flex-1 min-h-0 rounded-lg border border-slate-200
              bg-white p-4 overflow-hidden shadow-sm"
            >
              <img
                src={referencePhoto.src}
                alt="Reference pose"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <button
              onClick={() => handleSaveToLibrary()}
              className="rounded-lg bg-cyan-600 p-2 text-sm
                               font-semibold text-white hover:bg-cyan-500
                               transition"
            >
              Download Image
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {userPhotos.length === 0 ? (
            <div className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
              No photos yet. Take some photos to save locally on your browser.
            </div>
          ) : (
            userPhotos.map((photo, index) => (
              <Image
                key={`${photo.slice(0, 24)}-${index}`}
                src={photo}
                alt={`Captured pose ${index + 1}`}
                width={48}
                height={64}
                unoptimized
                className="h-16 w-12 rounded-lg border border-slate-200 bg-white object-cover shadow-sm"
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
