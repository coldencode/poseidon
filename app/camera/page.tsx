"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import PoseCamera from "@/src/components/pose-camera/PoseCamera";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const PHOTO_STORAGE_KEY = "poseidon.captures";
const MAX_CAPTURE_HISTORY = 12;

type PoseLibraryJson = {
  pose?: string;
  landmarks?: NormalizedLandmark[][];
  worldLandmarks?: NormalizedLandmark[][];
};

const parseStoredCaptures = (rawValue: string | null): string[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }

  return [];
};

const buildTargetPoseImagePath = (
  selectedPoseId: string,
  poseFileName?: string
) => (poseFileName ? `/pose-library/${poseFileName}` : `/pose-library/${selectedPoseId}.png`);

const appendCacheToken = (path: string, token: number) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${token}`;
};

function CameraPageContent() {
  const searchParams = useSearchParams();
  const selectedPoseId = searchParams.get("pose");

  const [isMobileViewport, setIsMobileViewport] = useState(true);

  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [targetPoseLandmarks, setTargetPoseLandmarks] = useState<
    NormalizedLandmark[] | undefined
  >(undefined);
  const [targetPoseImage, setTargetPoseImage] = useState<string | null>(null);
  const [targetPoseLabel, setTargetPoseLabel] = useState<string | null>(null);
  const [poseMatchScore, setPoseMatchScore] = useState<number | null>(null);
  const [showUserSkeleton, setShowUserSkeleton] = useState(true);
  const [showTargetSkeleton, setShowTargetSkeleton] = useState(false);
  const [targetImageRefreshToken, setTargetImageRefreshToken] = useState(0);

  const targetPoseImageUrl = useMemo(() => {
    if (!targetPoseImage) {
      return null;
    }
    return appendCacheToken(targetPoseImage, targetImageRefreshToken);
  }, [targetPoseImage, targetImageRefreshToken]);

  const handlePhotoCaptured = useCallback((imageDataUrl: string) => {
    setCapturedPhotos((previousPhotos) => {
      const updatedPhotos = [imageDataUrl, ...previousPhotos].slice(
        0,
        MAX_CAPTURE_HISTORY
      );
      localStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(updatedPhotos));
      return updatedPhotos;
    });
  }, []);

  useEffect(() => {
    const savedPhotos = localStorage.getItem(PHOTO_STORAGE_KEY);
    const parsedPhotos = parseStoredCaptures(savedPhotos);
    if (parsedPhotos.length > 0) {
      setCapturedPhotos(parsedPhotos);
    } else if (savedPhotos) {
      localStorage.removeItem(PHOTO_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    mobileQuery.addEventListener("change", handleViewportChange);
    return () => {
      mobileQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

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
        console.log(parsed)
        const firstLandmarks = Array.isArray(parsed.landmarks)
          ? parsed.landmarks[0]
          : Array.isArray(parsed.worldLandmarks)
            ? parsed.worldLandmarks[0]
            : undefined;

        if (!isActive) {
          return;
        }

        setTargetPoseLandmarks(firstLandmarks);
        const targetImagePath = buildTargetPoseImagePath(
          selectedPoseId,
          parsed.pose
        );
        setTargetPoseImage(targetImagePath);
        setTargetImageRefreshToken((previousToken) => previousToken + 1);
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

  const frameSize = useMemo(
    () => ({
      width: isMobileViewport ? 9 : 16,
      height: isMobileViewport ? 16 : 9,
    }),
    [isMobileViewport]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 text-slate-900">
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.24em] text-sky-600 uppercase">POSEIDON CAMERA</p>
            <h1 className="mt-1 text-lg font-semibold leading-tight">Live Landmark Detection</h1>
            {targetPoseLabel ? (
              <p className="mt-1 text-xs text-slate-500">
                Target overlay: <span className="font-medium capitalize">{targetPoseLabel}</span>
              </p>
            ) : null}
          </div>
          <Link href="/poses" className="text-xs text-slate-500 underline underline-offset-4">
            Change
          </Link>
        </div>

        {targetPoseImageUrl ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
            <Image
              src={targetPoseImageUrl}
              alt="Selected target pose"
              width={40}
              height={52}
              unoptimized
              className="h-13 w-10 rounded-md border border-slate-200 object-cover"
            />
            <p className="text-xs text-slate-600">
              Match your live pose to the overlaid skeleton guide.
            </p>
            <button
              type="button"
              onClick={() =>
                setTargetImageRefreshToken((previousToken) => previousToken + 1)
              }
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh target image
            </button>
            <span className="ml-auto rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
              Score: {poseMatchScore !== null ? `${poseMatchScore}%` : "--"}
            </span>
          </div>
        ) : null}

        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={showUserSkeleton}
              onChange={(event) => setShowUserSkeleton(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600"
            />
            User skeleton
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={showTargetSkeleton}
              onChange={(event) => setShowTargetSkeleton(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600"
            />
            Target skeleton
          </label>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-2">
          <PoseCamera
            frameSize={frameSize}
            showPoseStatus
            showControls
            onPhotoCaptured={handlePhotoCaptured}
            targetPoseLandmarks={targetPoseLandmarks}
            targetPoseImageUrl={targetPoseImageUrl ?? undefined}
            showTargetPoseOverlay
            showUserSkeleton={showUserSkeleton}
            showTargetSkeleton={showTargetSkeleton}
            onPoseMatchScoreUpdate={setPoseMatchScore}
          />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Client-side captures
            </p>
            <span className="text-xs text-slate-500">{capturedPhotos.length}</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {capturedPhotos.length === 0 ? (
              <div className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
                No photos yet. Tap capture to save locally in this browser.
              </div>
            ) : (
              capturedPhotos.map((photo, index) => (
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
      </main>
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 text-slate-900">
          <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Loading camera...
            </div>
          </main>
        </div>
      }
    >
      <CameraPageContent />
    </Suspense>
  );
}
