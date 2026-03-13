"use client"

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
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

const drawPoseLandmarks = (
  landmarks: NormalizedLandmark[][],
  canvasCtx: CanvasRenderingContext2D
) => {
  const drawingUtils = new DrawingUtils(canvasCtx);

  for (const poseLandmarks of landmarks) {
    drawingUtils.drawConnectors(poseLandmarks, POSE_CONNECTIONS, {
      color: "#00FF88",
      lineWidth: 3,
    });

    drawingUtils.drawLandmarks(poseLandmarks, {
      color: "#FF3366",
      lineWidth: 1,
      radius: 4,
    });
  }
};

const PoseCamera: React.FC<PoseCameraProps> = ({
  onSkeletonUpdate,
  callbackIntervalMs = 5000,
  showPoseStatus = false,
  frameSize,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number>(0);
  const callbackRef = useRef<PoseCameraProps["onSkeletonUpdate"]>(
    onSkeletonUpdate
  );
  const callbackIntervalRef = useRef<number>(callbackIntervalMs);
  const lastCallbackTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [poseDetected, setPoseDetected] = useState(false);

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
        video: {
          facingMode: "user",
          width: { ideal: safeFrameSize.width },
          height: { ideal: safeFrameSize.height },
        },
        audio: false,
      }) satisfies MediaStreamConstraints,
    [safeFrameSize.height, safeFrameSize.width]
  );

  const cameraContainerStyle = useMemo<React.CSSProperties>(
    () => ({
      ...styles.cameraContainer,
      aspectRatio: `${safeFrameSize.width} / ${safeFrameSize.height}`,
    }),
    [safeFrameSize.height, safeFrameSize.width]
  );

  // Set callback and interval refs to latest values
  useEffect(() => {
    callbackRef.current = onSkeletonUpdate;
  }, [onSkeletonUpdate]);

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
      const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints);

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        console.log("Camera started");
      }
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
      animationFrameRef.current = requestAnimationFrame(detectPose);
    };

    if (!video || !canvas || !poseLandmarker || video.readyState < 2) {
      scheduleNextFrame();
      return;
    }

    // Resize canvas to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

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

    const hasPose = landmarks.length > 0;
    setPoseDetected(hasPose);

    if (hasPose) {
      drawPoseLandmarks(landmarks, canvasCtx);
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
  }, []);

  // Initialize everything on mount
  useEffect(() => {
    let isActive = true;
    const videoEl = videoRef.current;

    const init = async () => {
      setIsLoading(true);
      await initPoseLandmarker();
      if (!isActive) return;
      await startCamera();
      if (!isActive) return;
      setIsLoading(false);
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

      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [initPoseLandmarker, startCamera]);

  // Start detection loop once loading is done
  useEffect(() => {
    if (!isLoading && !error) {
      animationFrameRef.current = requestAnimationFrame(detectPose);
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
      </div>
    </div>
  );
};

export default PoseCamera;
