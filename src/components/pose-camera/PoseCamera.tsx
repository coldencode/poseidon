"use client"

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Image from "next/image";
/**
 * Renders a responsive webcam feed with MediaPipe pose detection and an optional
 * skeleton callback for consuming landmark snapshots.
 *
 * @param props Component configuration.
 * @param props.onSkeletonUpdate Called with the latest pose snapshot at the configured interval.
 * @param props.callbackIntervalMs Minimum time between snapshot callback invocations.
 * @param props.showPoseStatus Controls whether the pose detection status badge is shown.
 * @param props.frameSize Required target frame dimensions used for aspect ratio and camera constraints.
 */
import {
  PoseLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { PoseCameraProps } from "@/app/types";
import { styles } from "./pose-camera.styles";

// MediaPipe pose landmark connections for drawing the skeleton
const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;
const MEDIAPIPE_WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const SCORE_LANDMARK_INDICES = [
  11, 12,
  13, 14,
  15, 16,
  23, 24,
  25, 26,
  27, 28,
  31, 32,
] as const;

type PoseProjection = {
  videoWidth: number;
  videoHeight: number;
  canvasWidth: number;
  canvasHeight: number;
};

type DrawStyle = {
  connectorColor: string;
  pointColor: string;
  lineWidth: number;
  radius: number;
};

type ProjectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const fitPoseLandmarksToFrame = (
  landmarks: NormalizedLandmark[]
): NormalizedLandmark[] => {
  return landmarks;
};

const isLikelyNormalizedLandmarks = (landmarks: NormalizedLandmark[]) =>
  landmarks.every((landmark) => landmark.x >= 0 && landmark.x <= 1 && landmark.y >= 0 && landmark.y <= 1);

const normalizePoseForComparison = (landmarks: NormalizedLandmark[]) => {
  const selectedPoints = SCORE_LANDMARK_INDICES
    .map((index) => landmarks[index])
    .filter((point): point is NormalizedLandmark => Boolean(point));

  if (selectedPoints.length < 6) {
    return null;
  }

  const centroid = selectedPoints.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x,
      y: accumulator.y + point.y,
    }),
    { x: 0, y: 0 }
  );

  const centerX = centroid.x / selectedPoints.length;
  const centerY = centroid.y / selectedPoints.length;

  const centered = selectedPoints.map((point) => ({
    x: point.x - centerX,
    y: point.y - centerY,
  }));

  const rms = Math.sqrt(
    centered.reduce((sum, point) => sum + point.x ** 2 + point.y ** 2, 0) /
      centered.length
  );

  if (!Number.isFinite(rms) || rms < 1e-6) {
    return null;
  }

  return centered.map((point) => ({
    x: point.x / rms,
    y: point.y / rms,
  }));
};

const computePoseMatchScore = (
  userLandmarks: NormalizedLandmark[],
  referenceLandmarks: NormalizedLandmark[]
) => {
  const normalizedUser = normalizePoseForComparison(userLandmarks);
  const normalizedReference = normalizePoseForComparison(referenceLandmarks);

  if (!normalizedUser || !normalizedReference) {
    return null;
  }

  const comparedLength = Math.min(normalizedUser.length, normalizedReference.length);
  if (comparedLength === 0) {
    return null;
  }

  const averageDistance =
    normalizedUser.slice(0, comparedLength).reduce((sum, userPoint, index) => {
      const referencePoint = normalizedReference[index];
      const deltaX = userPoint.x - referencePoint.x;
      const deltaY = userPoint.y - referencePoint.y;
      return sum + Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }, 0) / comparedLength;

  return Math.round(Math.max(0, Math.min(100, 100 - averageDistance * 42)));
};

const drawPoseLandmarkSet = (
  poseLandmarks: NormalizedLandmark[],
  canvasCtx: CanvasRenderingContext2D,
  projection: PoseProjection,
  style: DrawStyle
) => {
  const scale = Math.max(
    projection.canvasWidth / projection.videoWidth,
    projection.canvasHeight / projection.videoHeight
  );
  const drawnWidth = projection.videoWidth * scale;
  const drawnHeight = projection.videoHeight * scale;
  const offsetX = (projection.canvasWidth - drawnWidth) / 2;
  const offsetY = (projection.canvasHeight - drawnHeight) / 2;

  const projectPoint = (landmark: NormalizedLandmark) => ({
    x: landmark.x * projection.videoWidth * scale + offsetX,
    y: landmark.y * projection.videoHeight * scale + offsetY,
  });

  canvasCtx.strokeStyle = style.connectorColor;
  canvasCtx.lineWidth = style.lineWidth;
  canvasCtx.fillStyle = style.pointColor;

  for (const connection of POSE_CONNECTIONS) {
    const startIndex =
      Array.isArray(connection) ? connection[0] : connection.start;
    const endIndex = Array.isArray(connection) ? connection[1] : connection.end;

    const start = poseLandmarks[startIndex];
    const end = poseLandmarks[endIndex];

    if (!start || !end) {
      continue;
    }

    const startPoint = projectPoint(start);
    const endPoint = projectPoint(end);

    canvasCtx.beginPath();
    canvasCtx.moveTo(startPoint.x, startPoint.y);
    canvasCtx.lineTo(endPoint.x, endPoint.y);
    canvasCtx.stroke();
  }

  for (const landmark of poseLandmarks) {
    const point = projectPoint(landmark);
    canvasCtx.beginPath();
    canvasCtx.arc(point.x, point.y, style.radius, 0, Math.PI * 2);
    canvasCtx.fill();
  }
};

const getCenteredMobileGuideRect = (
  canvasWidth: number,
  canvasHeight: number,
  mobileAspectRatio = 9 / 16
): ProjectionRect => {
  const canvasAspect = canvasWidth / canvasHeight;

  if (canvasAspect > mobileAspectRatio) {
    const guideWidth = canvasHeight * mobileAspectRatio;
    return {
      x: (canvasWidth - guideWidth) / 2,
      y: 0,
      width: guideWidth,
      height: canvasHeight,
    };
  }

  const guideHeight = canvasWidth / mobileAspectRatio;
  return {
    x: 0,
    y: (canvasHeight - guideHeight) / 2,
    width: canvasWidth,
    height: guideHeight,
  };
};

const drawPoseLandmarkSetInRect = (
  poseLandmarks: NormalizedLandmark[],
  canvasCtx: CanvasRenderingContext2D,
  rect: ProjectionRect,
  style: DrawStyle
) => {
  const projectPoint = (landmark: NormalizedLandmark) => ({
    x: rect.x + landmark.x * rect.width,
    y: rect.y + landmark.y * rect.height,
  });

  canvasCtx.strokeStyle = style.connectorColor;
  canvasCtx.lineWidth = style.lineWidth;
  canvasCtx.fillStyle = style.pointColor;

  for (const connection of POSE_CONNECTIONS) {
    const startIndex =
      Array.isArray(connection) ? connection[0] : connection.start;
    const endIndex = Array.isArray(connection) ? connection[1] : connection.end;

    const start = poseLandmarks[startIndex];
    const end = poseLandmarks[endIndex];

    if (!start || !end) {
      continue;
    }

    const startPoint = projectPoint(start);
    const endPoint = projectPoint(end);

    canvasCtx.beginPath();
    canvasCtx.moveTo(startPoint.x, startPoint.y);
    canvasCtx.lineTo(endPoint.x, endPoint.y);
    canvasCtx.stroke();
  }

  for (const landmark of poseLandmarks) {
    const point = projectPoint(landmark);
    canvasCtx.beginPath();
    canvasCtx.arc(point.x, point.y, style.radius, 0, Math.PI * 2);
    canvasCtx.fill();
  }
};


const PoseCamera: React.FC<PoseCameraProps> = ({
  onSkeletonUpdate,
  onPhotoCaptured,
  onPoseMatchScoreUpdate,
  callbackIntervalMs = 5000,
  showPoseStatus = false,
  showControls = true,
  targetPoseLandmarks,
  showTargetPoseOverlay = false,
  frameSize,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number>(0);
  const callbackRef = useRef<PoseCameraProps["onSkeletonUpdate"]>(
    onSkeletonUpdate
  );
  const poseMatchCallbackRef = useRef<PoseCameraProps["onPoseMatchScoreUpdate"]>(
    onPoseMatchScoreUpdate
  );
  const callbackIntervalRef = useRef<number>(callbackIntervalMs);
  const lastCallbackTimeRef = useRef<number>(0);
  const lastScoreUpdateTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const detectPoseRef = useRef<() => void>(() => undefined);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [poseDetected, setPoseDetected] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "user"
  );
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [lastCapturedImage, setLastCapturedImage] = useState<string | null>(
    null
  );
  const [poseMatchScore, setPoseMatchScore] = useState<number | null>(null);

  const safeFrameSize = useMemo(
    () => ({
      width: Math.max(1, frameSize.width),
      height: Math.max(1, frameSize.height),
    }),
    [frameSize.height, frameSize.width]
  );

  const cameraConstraints = useMemo(
    () =>
      ({
        // Do NOT constrain width/height here — doing so forces a low-resolution
        // stream (e.g. 640×480) that looks blurry when stretched to fill modern
        // high-DPI screens. Let the browser negotiate the camera's native
        // resolution. frameSize is used only for the container's aspect ratio.
        video: { facingMode },
        audio: false,
      }) satisfies MediaStreamConstraints,
    [facingMode]
  );

  const cameraContainerStyle = useMemo<React.CSSProperties>(
    () => ({
      ...styles.cameraContainer,
      aspectRatio: `${safeFrameSize.width} / ${safeFrameSize.height}`,
    }),
    [safeFrameSize.height, safeFrameSize.width]
  );

  const fittedTargetPoseLandmarks = useMemo(() => {
    if (!targetPoseLandmarks || targetPoseLandmarks.length === 0) {
      return undefined;
    }

    return fitPoseLandmarksToFrame(targetPoseLandmarks);
  }, [targetPoseLandmarks]);

  // Set callback and interval refs to latest values
  useEffect(() => {
    callbackRef.current = onSkeletonUpdate;
  }, [onSkeletonUpdate]);

  useEffect(() => {
    poseMatchCallbackRef.current = onPoseMatchScoreUpdate;
  }, [onPoseMatchScoreUpdate]);

  useEffect(() => {
    callbackIntervalRef.current = callbackIntervalMs;
  }, [callbackIntervalMs]);

  // Initialize MediaPipe Pose Landmarker
  const initPoseLandmarker = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        MEDIAPIPE_WASM_BASE_URL
      );

      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: POSE_MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      poseLandmarkerRef.current = poseLandmarker;
      console.log("Pose Tracker initialised");
    } catch (err) {
      console.error("Failed to initialise Pose Tracker:", err);
      setError("Failed to load pose detection model. Please refresh.");
    }
  }, []);

  // Start webcam
  const startCamera = useCallback(async () => {
    try {
      setError(null);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints);

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        console.log("Camera started");
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === "videoinput");
      setCanSwitchCamera(videoInputs.length > 1);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      console.error("Camera access denied:", err);
      setError(
        "Camera access denied. Please allow camera access and refresh."
      );
    }
  }, [cameraConstraints]);

  // Detection loop
  const detectPose = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const poseLandmarker = poseLandmarkerRef.current;
    const scheduleNextFrame = () => {
      animationFrameRef.current = requestAnimationFrame(() => {
        detectPoseRef.current();
      });
    };

    if (!video || !canvas || !poseLandmarker || video.readyState < 2) {
      scheduleNextFrame();
      return;
    }

    const displayWidth = Math.floor(canvas.clientWidth);
    const displayHeight = Math.floor(canvas.clientHeight);

    if (displayWidth <= 0 || displayHeight <= 0) {
      scheduleNextFrame();
      return;
    }

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) {
      scheduleNextFrame();
      return;
    }

    // Clear previous frame
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    const timestamp = performance.now();
    const result = poseLandmarker.detectForVideo(video, timestamp);
    const landmarks = result.landmarks ?? [];
    const worldLandmarks = result.worldLandmarks ?? [];

    const hasPose = landmarks.length > 0;
    setPoseDetected(hasPose);

    if (showTargetPoseOverlay && fittedTargetPoseLandmarks && fittedTargetPoseLandmarks.length > 0) {
      const mobileGuideRect = getCenteredMobileGuideRect(canvas.width, canvas.height);
      drawPoseLandmarkSetInRect(fittedTargetPoseLandmarks, canvasCtx, mobileGuideRect, {
        connectorColor: "rgba(56, 189, 248, 0.95)",
        pointColor: "rgba(125, 211, 252, 0.95)",
        lineWidth: 2,
        radius: 3,
      });
    }

    if (hasPose) {
      const shouldScoreAgainstNormalizedTarget =
        fittedTargetPoseLandmarks && isLikelyNormalizedLandmarks(fittedTargetPoseLandmarks);
      const userLandmarksForScore = worldLandmarks[0] ?? landmarks[0];
      const score = fittedTargetPoseLandmarks
        ? computePoseMatchScore(
            shouldScoreAgainstNormalizedTarget ? landmarks[0] : userLandmarksForScore,
            fittedTargetPoseLandmarks
          )
        : null;
      const currentTime = performance.now();

      if (currentTime - lastScoreUpdateTimeRef.current >= 120) {
        lastScoreUpdateTimeRef.current = currentTime;
        setPoseMatchScore(score);
        const callback = poseMatchCallbackRef.current;
        if (callback) {
          callback(score);
        }
      }

      for (const poseLandmarks of landmarks) {
        drawPoseLandmarkSet(poseLandmarks, canvasCtx, {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
        }, {
          connectorColor: "#00FF88",
          pointColor: "#FF3366",
          lineWidth: 3,
          radius: 4,
        });
      }
    } else if (poseMatchScore !== null) {
      setPoseMatchScore(null);
      const callback = poseMatchCallbackRef.current;
      if (callback) {
        callback(null);
      }
    }

    const callbackFn = callbackRef.current;
    // If enough time has passed since last callback, invoke with latest pose data
    if (
      callbackFn &&
      timestamp - lastCallbackTimeRef.current >= callbackIntervalRef.current
    ) {
      lastCallbackTimeRef.current = timestamp;
      callbackFn({
        timestamp,
        landmarks,
        hasPose,
      });
    }

    scheduleNextFrame();
  }, [showTargetPoseOverlay, fittedTargetPoseLandmarks, poseMatchScore]);

  useEffect(() => {
    detectPoseRef.current = detectPose;
  }, [detectPose]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;

    const captureContext = captureCanvas.getContext("2d");
    if (!captureContext) {
      return;
    }

    captureContext.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    const imageDataUrl = captureCanvas.toDataURL("image/jpeg", 0.92);

    setLastCapturedImage(imageDataUrl);
    if (onPhotoCaptured) {
      onPhotoCaptured(imageDataUrl);
    }
  }, [onPhotoCaptured]);

  const toggleCameraFacingMode = useCallback(() => {
    if (!canSwitchCamera) {
      return;
    }
    setIsLoading(true);
    setFacingMode((previousMode) =>
      previousMode === "user" ? "environment" : "user"
    );
  }, [canSwitchCamera]);

  // Initialize everything on mount
  useEffect(() => {
    let isActive = true;

    const init = async () => {
      await initPoseLandmarker();
      if (!isActive) return;
    };

    init();

    return () => {
      isActive = false;

      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }

      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [initPoseLandmarker]);

  useEffect(() => {
    let isActive = true;
    const videoEl = videoRef.current;

    const bootCamera = async () => {
      setIsLoading(true);
      await startCamera();
      if (!isActive) return;
      setIsLoading(false);
    };

    if (!error) {
      bootCamera();
    }

    return () => {
      isActive = false;
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [facingMode, startCamera, error]);

  // Start detection loop once loading is done
  useEffect(() => {
    if (!isLoading && !error) {
      animationFrameRef.current = requestAnimationFrame(() => {
        detectPoseRef.current();
      });
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLoading, error, detectPose]);

  return (
    <div style={styles.container}>
      <div style={cameraContainerStyle}>
        {showPoseStatus && (
          <div style={styles.statsOverlay}>
            <span
              style={{
                ...styles.statusBadge,
                backgroundColor: poseDetected ? "#00FF88" : "#FF3366",
              }}
              aria-label={poseDetected ? "Pose detected" : "No pose detected"}
              title={poseDetected ? "Pose detected" : "No pose detected"}
            />
          </div>
        )}

        {showTargetPoseOverlay && fittedTargetPoseLandmarks ? (
          <div style={styles.poseMatchBadge}>
            Match: {poseMatchScore !== null ? `${poseMatchScore}%` : "--"}
          </div>
        ) : null}

        {isLoading && (
          <div style={styles.loadingOverlay}>
            <p style={styles.loadingText}>Loading pose detection model...</p>
          </div>
        )}

        {error && (
          <div style={styles.errorOverlay}>
            <p style={styles.errorText}>⚠️ {error}</p>
          </div>
        )}

        <video
          ref={videoRef}
          style={styles.video}
          playsInline
          muted
        />
        <canvas ref={canvasRef} style={styles.canvas} />

        {lastCapturedImage ? (
          <Image
            src={lastCapturedImage}
            alt="Last captured"
            width={72}
            height={96}
            unoptimized
            style={styles.capturedPreview}
          />
        ) : null}

        {showControls ? (
          <>
            {!canSwitchCamera ? (
              <p style={styles.helperText}>
                Camera switch may be unavailable on some laptops.
              </p>
            ) : null}
            <div style={styles.controlsBar}>
              <button
                type="button"
                onClick={toggleCameraFacingMode}
                disabled={!canSwitchCamera || isLoading}
                style={{
                  ...styles.controlButton,
                  ...((!canSwitchCamera || isLoading) ? styles.controlButtonDisabled : {}),
                }}
              >
                Flip
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={isLoading}
                style={styles.captureButton}
                aria-label="Capture photo"
                title="Capture photo"
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default PoseCamera;
