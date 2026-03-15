"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import LivePose from "@/src/components/live-pose/LivePose";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { RelativeDistanceGuidance, PoseSnapshot } from "@/app/types";
const PHOTO_STORAGE_KEY = "poseidon.captures";
const MAX_CAPTURE_HISTORY = 12;
const POSE_REDUCTION_KEEP = [0, 7, 8, 11, 12, 13, 14, 15, 16, 19, 20, 23, 24, 25, 26, 27, 28, 31, 32] as const;

type PoseLibraryJson = {
  pose?: string;
  landmarks?: NormalizedLandmark[][];
  worldLandmarks?: NormalizedLandmark[][];
};

const toReducedSkeletonJson = (landmarks: NormalizedLandmark[] | undefined): string => {
  if (!landmarks || landmarks.length === 0) {
    return "";
  }

  const reducedLandmarks = POSE_REDUCTION_KEEP
    .map((index) => landmarks[index])
    .filter((landmark): landmark is NormalizedLandmark => Boolean(landmark))
    .map((landmark) => [
      Number(landmark.x.toFixed(5)),
      Number(landmark.y.toFixed(5)),
      Number(landmark.z.toFixed(5)),
      Number((landmark.visibility ?? 0).toFixed(5)),
    ]);

  return JSON.stringify(reducedLandmarks);
};

function CameraPageContent() {
  const searchParams = useSearchParams();
  const selectedPoseId = searchParams.get("pose");
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.matchMedia("(max-width: 768px)").matches;
  });
  type CapturedItem = {
    id: string;
    photo: string;
    snapshot?: PoseSnapshot;
    targetPoseId?: string | null;
    targetPoseImage?: string | null;
  };
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    const saved = localStorage.getItem(PHOTO_STORAGE_KEY);
    if (!saved) {
      return [];
    }
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item === "object" && "photo" in item)
          .map((item) => ({
            id:
              typeof item.id === "string"
                ? item.id
                : `${Date.now()}-${Math.random()}`,
            photo: String(item.photo),
            snapshot: item.snapshot,
            targetPoseId: item.targetPoseId ?? null,
            targetPoseImage: item.targetPoseImage ?? null,
          }));
      }
    } catch {
      localStorage.removeItem(PHOTO_STORAGE_KEY);
    }
    return [];
  });

  const [selectedCaptureIndex, setSelectedCaptureIndex] = useState<
    number | null
  >(null);
  const [showResultConfirm, setShowResultConfirm] = useState(false);
  const [latestSnapshot, setLatestSnapshot] = useState<PoseSnapshot | null>(
    null,
  );
  const [targetPoseLandmarks, setTargetPoseLandmarks] = useState<
    NormalizedLandmark[] | undefined
  >(undefined);
  const [targetPoseWorldLandmarks, setTargetPoseWorldLandmarks] = useState<
    NormalizedLandmark[] | undefined
  >(undefined);
  const [targetPoseImage, setTargetPoseImage] = useState<string | null>(null);
  const [targetPoseLabel, setTargetPoseLabel] = useState<string | null>(null);
  const [relativeDistanceGuidance, setRelativeDistanceGuidance] =
    useState<RelativeDistanceGuidance | null>(null);
  const [chosenSkeletonForLlm, setChosenSkeletonForLlm] = useState<string>("");
  const [timerCountdown, setTimerCountdown] = useState<number | null>(null);
  const [triggerCaptureAt, setTriggerCaptureAt] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (timerCountdown === null || timerCountdown <= 0) {
      if (timerCountdown === 0) {
        setTriggerCaptureAt(Date.now());
      }
      setTimerCountdown(null);
      return;
    }
    const id = window.setTimeout(() => setTimerCountdown((c) => (c == null ? null : c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [timerCountdown]);

  const handlePhotoCaptured = useCallback((imageDataUrl: string) => {
    setCapturedItems((previousItems) => {
      const newItem: CapturedItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        photo: imageDataUrl,
        snapshot: latestSnapshot ?? undefined,
        targetPoseId: selectedPoseId,
        targetPoseImage,
      };
      const updatedItems = [newItem, ...previousItems].slice(
        0,
        MAX_CAPTURE_HISTORY,
      );
      localStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(updatedItems));
      return updatedItems;
    });
  }, [latestSnapshot, selectedPoseId, targetPoseImage]);

  const handlePhotoCallback = useCallback((_: PoseSnapshot | null) => {
    void _;
  }, []);

  const handleSelectCapture = useCallback((index: number) => {
    setSelectedCaptureIndex(index);
    setShowResultConfirm(true);
  }, []);

  const handleGoToResults = () => {
    if (selectedCaptureIndex === null) {
      return;
    }
    const selected = capturedItems[selectedCaptureIndex];
    localStorage.setItem("poseidon.lastComparison", JSON.stringify(selected));
    const targetId = selected.targetPoseId || selectedPoseId;
    setShowResultConfirm(false);
    if (targetId) {
      router.push(`/results?pose=${encodeURIComponent(targetId)}`);
    } else {
      router.push("/results");
    }
  };
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
        setTargetPoseWorldLandmarks(undefined);
        setTargetPoseImage(null);
        setTargetPoseLabel(null);
        setChosenSkeletonForLlm("");
        return;
      }
      try {
        const response = await fetch(`/pose-library/${selectedPoseId}.json`);
        if (!response.ok) {
          throw new Error("Failed to load selected pose");
        }

        const parsed = (await response.json()) as PoseLibraryJson;
        const firstLandmarks = Array.isArray(parsed.landmarks)
          ? parsed.landmarks[0]
          : undefined;
        const firstWorldLandmarks = Array.isArray(parsed.worldLandmarks)
          ? parsed.worldLandmarks[0]
          : undefined;
        if (!isActive) {
          return;
        }
        setTargetPoseLandmarks(firstLandmarks);
        setChosenSkeletonForLlm(toReducedSkeletonJson(firstLandmarks));
        setTargetPoseWorldLandmarks(firstWorldLandmarks);
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
        setTargetPoseWorldLandmarks(undefined);
        setTargetPoseImage(null);
        setTargetPoseLabel(null);
        setChosenSkeletonForLlm("");
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
    [isMobileViewport],
  );
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 text-slate-900">
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.24em] text-sky-600 uppercase">
              POSEIDON CAMERA
            </p>
            <h1 className="mt-1 text-lg font-semibold leading-tight">
              Live Landmark Detection
            </h1>
            {targetPoseLabel ? (
              <p className="mt-1 text-xs text-slate-500">
                Target overlay:{" "}
                <span className="font-medium capitalize">
                  {targetPoseLabel}
                </span>
              </p>
            ) : null}
          </div>
          <Link
            href="/poses"
            className="text-xs text-slate-500 underline underline-offset-4"
          >
            Change
          </Link>
        </div>
        {targetPoseImage ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
            <Image
              src={targetPoseImage}
              alt="Selected target pose"
              width={40}
              height={52}
              className="h-13 w-10 rounded-md border border-slate-200 object-cover"
            />
            <div className="ml-auto flex items-center gap-2">
              <p className="text-xs text-slate-600">
                Match your live pose to the overlaid skeleton guide.
              </p>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                Distance:{" "}
                {relativeDistanceGuidance
                  ? `${relativeDistanceGuidance.category} (${relativeDistanceGuidance.scaleRatio.toFixed(2)}x)`
                  : "--"}
              </span>
            </div>
          </div>
        ) : null}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-2">
          {timerCountdown !== null && (
            <div className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-[2px]">
              <span className="text-6xl font-bold tabular-nums text-white drop-shadow-lg">
                {timerCountdown}
              </span>
            </div>
          )}
          <LivePose
            frameSize={frameSize}
            showPoseStatus
            showControls
            onSkeletonUpdate={(snapshot) => setLatestSnapshot(snapshot)}
            onPhotoCaptured={handlePhotoCaptured}
            targetPoseLandmarks={targetPoseLandmarks}
            targetPoseWorldLandmarks={targetPoseWorldLandmarks}
            onRelativeDistanceGuidanceUpdate={setRelativeDistanceGuidance}
            chosenSkeletonForLlm={chosenSkeletonForLlm}
            photoIntervalMs={5000}
            minMatchScoreForLlm={80}
            onPhotoCallback={handlePhotoCallback}
            triggerCaptureAt={triggerCaptureAt ?? undefined}
            onStartTimer={(seconds) => setTimerCountdown(seconds)}
            timerCountdown={timerCountdown}
          />
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Client-side captures
            </p>
            <span className="text-xs text-slate-500">
              {capturedItems?.length ?? 0}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {capturedItems.length === 0 ? (
              <div className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
                No photos yet. Tap capture to save locally in this browser.
              </div>
            ) : (
              capturedItems.map((photo, index) => (
                <button
                  key={`${photo.photo.slice(0, 24)}-${index}`}
                  type="button"
                  onClick={() => handleSelectCapture(index)}
                  className="rounded-lg border border-slate-200 bg-white p-0 shadow-sm transition hover:scale-[1.02]"
                  aria-label={`Select captured pose ${index + 1} for comparison`}
                >
                  <Image
                    src={photo.photo}
                    alt={`Captured pose ${index + 1}`}
                    width={48}
                    height={64}
                    unoptimized
                    className="h-16 w-12 rounded-lg object-cover"
                  />
                </button>
              ))
            )}
            <label className="flex h-16 w-12 flex-shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-slate-400 shadow-sm transition hover:border-slate-400 hover:text-slate-600">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => handlePhotoCaptured(reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="mt-0.5 text-[10px]">Add</span>
            </label>
          </div>
        </div>
        {showResultConfirm && selectedCaptureIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
              <h2 className="text-base font-semibold">Go to Results</h2>
              <p className="mt-2 text-sm text-slate-600">
                You selected capture #{selectedCaptureIndex + 1}. Compare this
                photo with your target pose?
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowResultConfirm(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGoToResults}
                  className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                >
                  Yes, show results
                </button>
              </div>
            </div>
          </div>
        )}
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
