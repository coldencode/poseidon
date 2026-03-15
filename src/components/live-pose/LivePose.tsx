"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { PoseSnapshot } from "@/app/types";
import PoseCamera from "@/src/components/pose-camera/PoseCamera";
import LiveAIOutput from "@/src/components/live-pose/LiveAIOutput";

const POSE_REDUCTION_KEEP = [
  0,
  7,
  8,
  11,
  12,
  13,
  14,
  15,
  16,
  19,
  20,
  23,
  24,
  25,
  26,
  27,
  28,
  31,
  32,
] as const;

const toReducedSkeletonJson = (landmarks: NormalizedLandmark[] | null | undefined): string => {
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

type LivePoseProps = {
  frameSize: {
    width: number;
    height: number;
  };
  targetPoseLandmarks?: NormalizedLandmark[];
  chosenSkeletonForLlm?: string;
  photoIntervalMs?: number;
  minMatchScoreForLlm?: number;
  showPoseStatus?: boolean;
  showControls?: boolean;
  onPhotoCallback?: (snapshot: PoseSnapshot | null, poseMatchScore: number | null) => void;
  onPhotoCaptured?: (imageDataUrl: string) => void;
};

export default function LivePose({
  frameSize,
  targetPoseLandmarks,
  chosenSkeletonForLlm,
  photoIntervalMs = 5000,
  minMatchScoreForLlm = 80,
  showPoseStatus = true,
  showControls = true,
  onPhotoCallback,
  onPhotoCaptured,
}: LivePoseProps) {
  const [flashSignal, setFlashSignal] = useState(0);
  const [isAwaitingLlmResponse, setIsAwaitingLlmResponse] = useState(false);
  const [liveAiText, setLiveAiText] = useState<string | null>(null);
  const [nextPhotoAt, setNextPhotoAt] = useState<number | null>(null);
  const [msUntilNextPhoto, setMsUntilNextPhoto] = useState<number | null>(null);
  const [llmSlowResponseError, setLlmSlowResponseError] = useState(false);
  const [debugStatus, setDebugStatus] = useState<string>("idle");
  const [debugDetail, setDebugDetail] = useState<string>("");

  const latestPoseMatchScoreRef = useRef<number | null>(null);
  const latestSnapshotRef = useRef<PoseSnapshot | null>(null);
  const chosenSkeletonRef = useRef<string | undefined>(chosenSkeletonForLlm);
  const photoTimerRef = useRef<number | null>(null);
  const slowResponseTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chosenSkeletonRef.current = chosenSkeletonForLlm;
  }, [chosenSkeletonForLlm]);

  const clearPhotoTimer = useCallback(() => {
    if (photoTimerRef.current !== null) {
      window.clearTimeout(photoTimerRef.current);
      photoTimerRef.current = null;
    }
  }, []);

  const clearSlowResponseTimer = useCallback(() => {
    if (slowResponseTimerRef.current !== null) {
      window.clearTimeout(slowResponseTimerRef.current);
      slowResponseTimerRef.current = null;
    }
  }, []);

  const startPhotoTimer = useCallback(
    function schedulePhotoTimer(delayMs: number) {
      clearPhotoTimer();
      const start = Date.now();
      setNextPhotoAt(start + delayMs);
      setMsUntilNextPhoto(delayMs);

      photoTimerRef.current = window.setTimeout(() => {
        setNextPhotoAt(null);
        setMsUntilNextPhoto(null);
        setFlashSignal((current) => current + 1);

        const snapshot = latestSnapshotRef.current;
        const latestPoseMatchScore = latestPoseMatchScoreRef.current;
        onPhotoCallback?.(snapshot, latestPoseMatchScore);

        const currentChosenSkeleton = chosenSkeletonRef.current;
        const hasPose = Boolean(snapshot?.hasPose && snapshot.landmarks?.length > 0);
        const canSendLlm =
          hasPose &&
          latestPoseMatchScore !== null &&
          latestPoseMatchScore >= minMatchScoreForLlm &&
          Boolean(currentChosenSkeleton);

        if (!canSendLlm) {
          const skipReason = !hasPose
            ? "no pose"
            : latestPoseMatchScore === null
              ? "no score"
              : latestPoseMatchScore < minMatchScoreForLlm
                ? `score ${latestPoseMatchScore}% < ${minMatchScoreForLlm}%`
                : "no target pose";
          console.debug("[LivePose] Photo taken; skipping LLM call", {
            hasPose,
            poseMatchScore: latestPoseMatchScore,
            minMatchScoreForLlm,
            hasChosenSkeleton: Boolean(currentChosenSkeleton),
          });
          setDebugStatus("skipped");
          setDebugDetail(skipReason);
          schedulePhotoTimer(photoIntervalMs);
          return;
        }

        const userSkeleton = toReducedSkeletonJson(snapshot?.landmarks?.[0] ?? null);
        if (!userSkeleton || !currentChosenSkeleton) {
          console.debug("[LivePose] Photo taken; missing skeleton payload for LLM", {
            hasUserSkeleton: Boolean(userSkeleton),
            hasChosenSkeleton: Boolean(currentChosenSkeleton),
          });
          setDebugStatus("skipped");
          setDebugDetail("missing skeleton");
          schedulePhotoTimer(photoIntervalMs);
          return;
        }

        setIsAwaitingLlmResponse(true);
        setLlmSlowResponseError(false);
        setDebugStatus("requesting");
        setDebugDetail("");
        clearSlowResponseTimer();

        slowResponseTimerRef.current = window.setTimeout(() => {
          setLlmSlowResponseError(true);
        }, photoIntervalMs);

        const abortController = new AbortController();
        abortControllerRef.current?.abort();
        abortControllerRef.current = abortController;

        let didFail = false;

        fetch("/api/llm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_skeleton: userSkeleton,
            chosen_skeleton: currentChosenSkeleton,
          }),
          signal: abortController.signal,
        })
          .then(async (response) => {
            console.debug("[LivePose] LLM response received", {
              status: response.status,
              ok: response.ok,
            });
            const payload = await response.json();
            if (!response.ok || payload?.success === false) {
              throw new Error(payload?.error ?? "LLM request failed");
            }
            const text = typeof payload?.response === "string" ? payload.response : "";
            setLiveAiText(text);
            setDebugStatus("received");
            setDebugDetail(text.slice(0, 60));
          })
          .catch((error: unknown) => {
            if (error instanceof Error && error.name === "AbortError") {
              console.debug("[LivePose] LLM request aborted");
              setDebugStatus("aborted");
              setDebugDetail("");
              return;
            }
            didFail = true;
            const msg = error instanceof Error ? error.message : String(error);
            console.error("[LivePose] LLM request failed", error);
            setDebugStatus("failed");
            setDebugDetail(msg);
            setLiveAiText(null);
          })
          .finally(() => {
            clearSlowResponseTimer();
            setLlmSlowResponseError(false);
            if (!didFail) {
              // Resume photo loop only on success or abort.
              // A real failure leaves isAwaitingLlmResponse=true, halting photos.
              setIsAwaitingLlmResponse(false);
            }
          });

        console.debug("[LivePose] LLM request sent");
        setDebugStatus("requesting");
      }, delayMs);
    },
    [
      clearPhotoTimer,
      clearSlowResponseTimer,
      minMatchScoreForLlm,
      onPhotoCallback,
      photoIntervalMs,
    ]
  );

  useEffect(() => {
    if (isAwaitingLlmResponse) {
      clearPhotoTimer();
      setNextPhotoAt(null);
      setMsUntilNextPhoto(null);
      return;
    }

    startPhotoTimer(photoIntervalMs);
    return clearPhotoTimer;
  }, [clearPhotoTimer, isAwaitingLlmResponse, photoIntervalMs, startPhotoTimer]);

  useEffect(() => {
    return () => {
      clearPhotoTimer();
      clearSlowResponseTimer();
      abortControllerRef.current?.abort();
    };
  }, [clearPhotoTimer, clearSlowResponseTimer]);

  useEffect(() => {
    if (nextPhotoAt === null) {
      setMsUntilNextPhoto(null);
      return;
    }

    const updateCountdown = () => {
      setMsUntilNextPhoto(Math.max(0, nextPhotoAt - Date.now()));
    };

    updateCountdown();
    const countdownTimer = window.setInterval(updateCountdown, 200);

    return () => {
      window.clearInterval(countdownTimer);
    };
  }, [nextPhotoAt]);

  const shouldFadeAiOutput = Boolean(msUntilNextPhoto !== null && msUntilNextPhoto <= 2000);
  const shouldShowAiOutput = Boolean(liveAiText) && !isAwaitingLlmResponse;

  const poseCallbackIntervalMs = useMemo(() => Math.min(300, Math.max(120, Math.floor(photoIntervalMs / 10))), [
    photoIntervalMs,
  ]);

  return (
    <div className="relative">
      <PoseCamera
        frameSize={frameSize}
        showPoseStatus={showPoseStatus}
        showControls={showControls}
        callbackIntervalMs={poseCallbackIntervalMs}
        flashSignal={flashSignal}
        targetPoseLandmarks={targetPoseLandmarks}
        showTargetPoseOverlay={Boolean(targetPoseLandmarks)}
        onPhotoCaptured={onPhotoCaptured}
        onPoseMatchScoreUpdate={(score) => {
          latestPoseMatchScoreRef.current = score;
        }}
        onSkeletonUpdate={(snapshot) => {
          latestSnapshotRef.current = snapshot;
        }}
      />

      <LiveAIOutput text={liveAiText} visible={shouldShowAiOutput} fading={shouldFadeAiOutput} />

      {llmSlowResponseError ? (
        <div className="absolute bottom-3 right-3 z-50 rounded-md border border-red-300 bg-red-50/95 px-2 py-1 text-xs font-medium text-red-700 shadow-sm">
          LLM call took too long to respond.
        </div>
      ) : null}

      {/* Debug status badge */}
      <div className="absolute left-2 top-2 z-50 flex max-w-[calc(100%-1rem)] flex-col gap-0.5 rounded-lg border border-white/20 bg-black/70 px-2.5 py-1.5 font-mono text-[11px] leading-tight text-white shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
              debugStatus === "requesting"
                ? "animate-pulse bg-yellow-400"
                : debugStatus === "received"
                  ? "bg-green-400"
                  : debugStatus === "failed" || debugStatus === "aborted"
                    ? "bg-red-400"
                    : debugStatus === "skipped"
                      ? "bg-slate-400"
                      : "bg-slate-600"
            }`}
          />
          <span className="font-semibold uppercase tracking-widest opacity-90">{debugStatus}</span>
          {isAwaitingLlmResponse ? (
            <span className="ml-1 opacity-60">(waiting…)</span>
          ) : msUntilNextPhoto !== null ? (
            <span className="ml-1 opacity-60">next in {(msUntilNextPhoto / 1000).toFixed(1)}s</span>
          ) : null}
        </div>
        {debugDetail ? (
          <span className="truncate opacity-70">{debugDetail}</span>
        ) : null}
      </div>
    </div>
  );
}
