"use client";

import { useRouter, useSearchParams } from "next/navigation";
import SkeletonViewer from "./skeletonViewer";

import { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import { PHOTO_STORAGE_KEY, Point3D, Pose } from "../types";
import Image, { StaticImageData } from "next/image";
import { useEffect, useState } from "react";
import { detectPoseInFrame } from "@/src/lib/imageToPose";

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
  target,
}: {
  pose: Pose;
  referencePose: Pose;
  photo: string;
  referencePhoto: string;
  target?: string;
}) {
  const handleSaveToLibrary = async () => {
    if (!photo) return;

    const response = await fetch(photo);
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
    if (typeof window === "undefined") return [];
    const savedPhotos = localStorage.getItem(PHOTO_STORAGE_KEY);
    if (!savedPhotos) return [];
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
    Point3D[] | undefined
  >(undefined);
  const [targetPoseImage, setTargetPoseImage] = useState<string | null>(null);
  const [targetPoseLabel, setTargetPoseLabel] = useState<string | null>(null);
  const [currentUserImage, setCurrentUserImage] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return null;
      const savedPhotos = localStorage.getItem(PHOTO_STORAGE_KEY);
      try {
        const parsed = JSON.parse(savedPhotos ?? "[]");
        return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
      } catch {
        return null;
      }
    },
  );
  const [currentUserLandmarks, setCurrentUserLandmarks] = useState<Point3D[]>(
    [],
  );

  const detectPose = async () => {
    if (currentUserImage) {
      const pose = await detectPoseInFrame(currentUserImage);
      setCurrentUserLandmarks(pose.worldLandmarks as Point3D[]);
    }
    console.log(currentUserLandmarks);
  };

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
        if (!response.ok) throw new Error("Failed to load selected pose");

        const parsed = (await response.json()) as PoseLibraryJson;
        const firstLandmarks = Array.isArray(parsed.worldLandmarks)
          ? (parsed.worldLandmarks[0] as Point3D[])
          : undefined;

        if (!isActive) return;

        setTargetPoseLandmarks(firstLandmarks);
        setTargetPoseImage(
          parsed.pose
            ? `/pose-library/${parsed.pose}`
            : `/pose-library/${selectedPoseId}.png`,
        );
        setTargetPoseLabel(selectedPoseId.replace(/[-_]+/g, " "));
      } catch {
        if (!isActive) return;
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

  useEffect(() => {
    if (!currentUserImage) return;
    const runDetection = async () => {
      const result = await detectPoseInFrame(currentUserImage);
      setCurrentUserLandmarks(result.worldLandmarks as Point3D[]);
    };
    runDetection();
  }, [currentUserImage]);


  const handleTryAgain = () => {
    const targetQuery = target ? `?pose=${encodeURIComponent(target)}` : "";
    router.push(`/camera${targetQuery}`);
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] bg-slate-50
                  px-4 md:px-8 pb-[env(safe-area-inset-bottom)]
                  pt-[env(safe-area-inset-top)]"
    >
      <div className="mx-auto max-w-6xl flex flex-col justify-center min-h-[100dvh]">
        {/* Heading */}
        <div className="mb-4">
          <p className="text-xs tracking-[0.24em] text-sky-600 uppercase">
            Poseidon Analyser
          </p>
          <h1 className="mt-1 text-lg font-semibold leading-tight">
            Compare Your Pose!
          </h1>
        </div>

        {/* 3-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:h-[600px]">
          {/* Left col — User Photo */}
          <div className="flex flex-col gap-2 h-[500px] md:h-full col-span-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">
              Your Photo
            </p>
            <div
              className="flex-1 min-h-0 rounded-lg border border-slate-200
                          bg-white p-4 relative overflow-hidden shadow-sm"
            >
              {photo ? (
                <div className="relative w-full h-full">
                  <Image
                    src={photo}
                    alt="Your Pose"
                    fill
                    unoptimized
                    className="object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400">
                  No photo
                </div>
              )}
            </div>
            <button
              className="rounded-lg border border-slate-700
                               bg-slate-900 p-2 text-sm text-slate-400
                               hover:border-slate-500 transition font-semibold"
              onClick={handleTryAgain}
            >
              Try Again
            </button>
            <div className="h-[38px]" />
          </div>

          {/* Right col — Reference Photo (moved before skeleton on mobile) */}
          <div className="flex flex-col gap-2 h-[500px] md:h-full col-span-1 md:order-last">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">
              Reference Pose
            </p>
            <div
              className="flex-1 min-h-0 rounded-lg border border-slate-200
                          bg-white p-4 relative overflow-hidden shadow-sm"
            >
              {referencePhoto ? (
                <div className="relative w-full h-full">
                  <Image
                    src={referencePhoto}
                    alt="Reference Pose"
                    fill
                    unoptimized
                    className="object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400">
                  No reference
                </div>
              )}
            </div>
            <div className="h-[38px]" />
          </div>

          {/* Middle col — Skeleton Viewer (full width on mobile, middle on desktop) */}
          <div className="flex flex-col gap-2 h-[400px] md:h-full col-span-2 md:col-span-1 md:order-none order-last">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">
              Pose Comparison
            </p>
            <div
              className="flex-1 min-h-0 rounded-lg border border-slate-200
                          bg-white p-4 shadow-sm"
            >
              <SkeletonViewer
                pose={currentUserLandmarks}
                referencePose={targetPoseLandmarks}
              />
            </div>
            <div className="h-[38px]" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition font-semibold shadow-sm"
            onClick={() => router.push("/poses")}
          >
            Try Again
          </button>
          <button
            onClick={() => {
              detectPose();
              handleSaveToLibrary();
            }}
            className="rounded-lg bg-cyan-600 p-2 text-sm font-semibold text-white hover:bg-cyan-500 transition shadow-sm"
          >
            Download Image
          </button>
        </div>

        {/* Photo gallery strip */}
        <div className="pt-4 flex gap-2 overflow-x-auto pb-1">
          {userPhotos.length === 0 ? (
            <div className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
              No photos yet. Take some photos to save locally on your browser.
            </div>
          ) : (
            userPhotos.map((photo, index) => (
              <div
                key={`${photo.slice(0, 24)}-${index}`}
                className="relative group flex-shrink-0"
                onClick={() => setCurrentUserImage(photo)}
              >
                <Image
                  src={photo}
                  alt={`Captured pose ${index + 1}`}
                  width={48}
                  height={64}
                  unoptimized
                  className={`h-16 w-12 rounded-lg border bg-white object-cover shadow-sm cursor-pointer transition
                    ${
                      currentUserImage === photo
                        ? "border-cyan-500 ring-2 ring-cyan-400"
                        : "border-slate-200"
                    }`}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const updated = userPhotos.filter((_, i) => i !== index);
                    setUserPhotos(updated);
                    localStorage.setItem(
                      PHOTO_STORAGE_KEY,
                      JSON.stringify(updated),
                    );
                    if (currentUserImage === photo)
                      setCurrentUserImage(updated[0] ?? null);
                  }}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden group-hover:flex"
                  aria-label="Delete photo"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
