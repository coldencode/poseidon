
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
import type {
  PoseCameraProps,
  RelativeDistanceGuidance,
} from "@/app/types";
import { styles } from "./pose-camera.styles";
import {
  type BoneEvaluation,
  computePoseGuidance,
  computePoseMatchScore,
  computeRelativeDistanceGuidance,
  isLikelyNormalizedLandmarks,
} from "./pose-calculations";
// MediaPipe pose landmark connections for drawing the skeleton
const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;
const MEDIAPIPE_WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
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
    x: rect.x + (1 - landmark.x) * rect.width,
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

const drawSoftBodyOverlayInRect = (
  poseLandmarks: NormalizedLandmark[],
  canvasCtx: CanvasRenderingContext2D,
  rect: ProjectionRect
) => {
  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = canvasCtx.canvas.width;
  overlayCanvas.height = canvasCtx.canvas.height;

  const overlayCtx = overlayCanvas.getContext("2d");
  if (!overlayCtx) {
    return;
  }

  const drawCtx = overlayCtx;
  const overlayAlpha = 0.24;

  const projectPoint = (landmark: NormalizedLandmark) => ({
    x: rect.x + (1 - landmark.x) * rect.width,
    y: rect.y + landmark.y * rect.height,
  });

  const normalizeVector = (x: number, y: number) => {
    const magnitude = Math.hypot(x, y);
    if (magnitude <= 1e-6) {
      return { x: 0, y: -1 };
    }

    return { x: x / magnitude, y: y / magnitude };
  };

  const nose = poseLandmarks[0];
  const leftMouth = poseLandmarks[9];
  const rightMouth = poseLandmarks[10];
  const leftShoulder = poseLandmarks[11];
  const rightShoulder = poseLandmarks[12];
  const leftElbow = poseLandmarks[13];
  const rightElbow = poseLandmarks[14];
  const leftWrist = poseLandmarks[15];
  const rightWrist = poseLandmarks[16];
  const leftHip = poseLandmarks[23];
  const rightHip = poseLandmarks[24];
  const leftKnee = poseLandmarks[25];
  const rightKnee = poseLandmarks[26];
  const leftAnkle = poseLandmarks[27];
  const rightAnkle = poseLandmarks[28];

  if (
    !leftShoulder ||
    !rightShoulder ||
    !leftElbow ||
    !rightElbow ||
    !leftWrist ||
    !rightWrist ||
    !leftHip ||
    !rightHip ||
    !leftKnee ||
    !rightKnee ||
    !leftAnkle ||
    !rightAnkle
  ) {
    return;
  }

  const leftShoulderPoint = projectPoint(leftShoulder);
  const rightShoulderPoint = projectPoint(rightShoulder);
  const leftElbowPoint = projectPoint(leftElbow);
  const rightElbowPoint = projectPoint(rightElbow);
  const leftWristPoint = projectPoint(leftWrist);
  const rightWristPoint = projectPoint(rightWrist);
  const leftHipPoint = projectPoint(leftHip);
  const rightHipPoint = projectPoint(rightHip);
  const leftKneePoint = projectPoint(leftKnee);
  const rightKneePoint = projectPoint(rightKnee);
  const leftAnklePoint = projectPoint(leftAnkle);
  const rightAnklePoint = projectPoint(rightAnkle);

  const shoulderMidPoint = {
    x: (leftShoulderPoint.x + rightShoulderPoint.x) / 2,
    y: (leftShoulderPoint.y + rightShoulderPoint.y) / 2,
  };
  const shoulderWidth = Math.hypot(
    rightShoulderPoint.x - leftShoulderPoint.x,
    rightShoulderPoint.y - leftShoulderPoint.y
  );

  const nosePoint = nose ? projectPoint(nose) : null;
  const mouthMidPoint =
    leftMouth && rightMouth
      ? {
          x: (projectPoint(leftMouth).x + projectPoint(rightMouth).x) / 2,
          y: (projectPoint(leftMouth).y + projectPoint(rightMouth).y) / 2,
        }
      : null;

  const headCenter = nosePoint ? nosePoint : {
    x: shoulderMidPoint.x,
    y: shoulderMidPoint.y - shoulderWidth * 0.52,
  };
  const headRadius = Math.max(14, Math.min(shoulderWidth * 0.34, rect.width * 0.11));
  const bodyColor = "rgb(226, 232, 240)";
  const limbWidth = Math.max(8, Math.min(shoulderWidth * 0.26, 22));
  const outlineColor = "rgba(148, 163, 184, 0.98)";
  const outlineWidth = Math.max(2, Math.min(limbWidth * 0.2, 5));

  const getLandmarkDepth = (landmark: NormalizedLandmark) =>
    Number.isFinite(landmark.z) ? landmark.z : 0;

  const averageDepth = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const leftArmDepth = averageDepth([
    getLandmarkDepth(leftShoulder),
    getLandmarkDepth(leftElbow),
    getLandmarkDepth(leftWrist),
  ]);
  const rightArmDepth = averageDepth([
    getLandmarkDepth(rightShoulder),
    getLandmarkDepth(rightElbow),
    getLandmarkDepth(rightWrist),
  ]);
  const backArmIsLeft = leftArmDepth > rightArmDepth;

  const drawTorsoTrapezium = () => {
    const torsoPadding = Math.max(10, limbWidth * 0.56);
    const torsoCenter = {
      x:
        (leftShoulderPoint.x +
          rightShoulderPoint.x +
          rightHipPoint.x +
          leftHipPoint.x) /
        4,
      y:
        (leftShoulderPoint.y +
          rightShoulderPoint.y +
          rightHipPoint.y +
          leftHipPoint.y) /
        4,
    };

    const expandPoint = (point: { x: number; y: number }) => {
      const direction = normalizeVector(
        point.x - torsoCenter.x,
        point.y - torsoCenter.y
      );

      return {
        x: point.x + direction.x * torsoPadding,
        y: point.y + direction.y * torsoPadding,
      };
    };

    const expandedLeftShoulder = expandPoint(leftShoulderPoint);
    const expandedRightShoulder = expandPoint(rightShoulderPoint);
    const expandedRightHip = expandPoint(rightHipPoint);
    const expandedLeftHip = expandPoint(leftHipPoint);

    const corners = [
      expandedLeftShoulder,
      expandedRightShoulder,
      expandedRightHip,
      expandedLeftHip,
    ];

    const cornerRadius = Math.max(6, Math.min(torsoPadding * 0.9, limbWidth * 0.95));

    const getRoundedCornerPoints = (
      previousPoint: { x: number; y: number },
      currentPoint: { x: number; y: number },
      nextPoint: { x: number; y: number },
      radius: number
    ) => {
      const vectorToPrevious = {
        x: previousPoint.x - currentPoint.x,
        y: previousPoint.y - currentPoint.y,
      };
      const vectorToNext = {
        x: nextPoint.x - currentPoint.x,
        y: nextPoint.y - currentPoint.y,
      };

      const previousLength = Math.hypot(vectorToPrevious.x, vectorToPrevious.y);
      const nextLength = Math.hypot(vectorToNext.x, vectorToNext.y);

      if (previousLength <= 1e-6 || nextLength <= 1e-6) {
        return {
          startPoint: currentPoint,
          endPoint: currentPoint,
        };
      }

      const effectiveRadius = Math.min(radius, previousLength * 0.45, nextLength * 0.45);
      const previousDirection = {
        x: vectorToPrevious.x / previousLength,
        y: vectorToPrevious.y / previousLength,
      };
      const nextDirection = {
        x: vectorToNext.x / nextLength,
        y: vectorToNext.y / nextLength,
      };

      return {
        startPoint: {
          x: currentPoint.x + previousDirection.x * effectiveRadius,
          y: currentPoint.y + previousDirection.y * effectiveRadius,
        },
        endPoint: {
          x: currentPoint.x + nextDirection.x * effectiveRadius,
          y: currentPoint.y + nextDirection.y * effectiveRadius,
        },
      };
    };

    const firstRounded = getRoundedCornerPoints(
      corners[corners.length - 1],
      corners[0],
      corners[1],
      cornerRadius
    );

    drawCtx.beginPath();
    drawCtx.moveTo(firstRounded.endPoint.x, firstRounded.endPoint.y);

    for (let index = 1; index <= corners.length; index += 1) {
      const currentCorner = corners[index % corners.length];
      const previousCorner = corners[(index - 1 + corners.length) % corners.length];
      const nextCorner = corners[(index + 1) % corners.length];
      const roundedPoints = getRoundedCornerPoints(
        previousCorner,
        currentCorner,
        nextCorner,
        cornerRadius
      );

      drawCtx.lineTo(roundedPoints.startPoint.x, roundedPoints.startPoint.y);
      drawCtx.quadraticCurveTo(
        currentCorner.x,
        currentCorner.y,
        roundedPoints.endPoint.x,
        roundedPoints.endPoint.y
      );
    }

    drawCtx.closePath();
    drawCtx.fill();
    drawCtx.lineWidth = outlineWidth;
    drawCtx.strokeStyle = outlineColor;
    drawCtx.stroke();
    drawCtx.strokeStyle = bodyColor;
  };

  const drawSoftSegment = (
    startPoint: { x: number; y: number },
    controlPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    width: number
  ) => {
    drawCtx.beginPath();
    drawCtx.moveTo(startPoint.x, startPoint.y);
    drawCtx.quadraticCurveTo(controlPoint.x, controlPoint.y, endPoint.x, endPoint.y);
    drawCtx.lineWidth = width + outlineWidth * 2;
    drawCtx.strokeStyle = outlineColor;
    drawCtx.stroke();

    drawCtx.beginPath();
    drawCtx.moveTo(startPoint.x, startPoint.y);
    drawCtx.quadraticCurveTo(controlPoint.x, controlPoint.y, endPoint.x, endPoint.y);
    drawCtx.lineWidth = width;
    drawCtx.strokeStyle = bodyColor;
    drawCtx.stroke();
  };

  drawCtx.save();
  drawCtx.strokeStyle = bodyColor;
  drawCtx.fillStyle = bodyColor;
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";

  drawTorsoTrapezium();

  const drawLeftArm = () => {
    drawSoftSegment(
      leftShoulderPoint,
      leftElbowPoint,
      leftWristPoint,
      limbWidth
    );
  };

  const drawRightArm = () => {
    drawSoftSegment(
      rightShoulderPoint,
      rightElbowPoint,
      rightWristPoint,
      limbWidth
    );
  };

  if (backArmIsLeft) {
    drawLeftArm();
  } else {
    drawRightArm();
  }

  if (backArmIsLeft) {
    drawRightArm();
  } else {
    drawLeftArm();
  }

  drawSoftSegment(
    leftHipPoint,
    leftKneePoint,
    leftAnklePoint,
    limbWidth * 1.05
  );
  drawSoftSegment(
    rightHipPoint,
    rightKneePoint,
    rightAnklePoint,
    limbWidth * 1.05
  );

  drawCtx.beginPath();
  drawCtx.arc(headCenter.x, headCenter.y, headRadius, 0, Math.PI * 2);
  drawCtx.fill();
  drawCtx.lineWidth = outlineWidth;
  drawCtx.strokeStyle = outlineColor;
  drawCtx.stroke();
  drawCtx.strokeStyle = bodyColor;

  if (nosePoint && mouthMidPoint) {
    const directionVector = {
      x: mouthMidPoint.x - nosePoint.x,
      y: mouthMidPoint.y - nosePoint.y,
    };
    const directionLength = Math.hypot(directionVector.x, directionVector.y);
    const normalizedDirection = directionLength > 1e-6
      ? {
          x: directionVector.x / directionLength,
          y: directionVector.y / directionLength,
        }
      : { x: 0, y: 1 };

    const originToCenter = {
      x: nosePoint.x - headCenter.x,
      y: nosePoint.y - headCenter.y,
    };
    const projection =
      originToCenter.x * normalizedDirection.x +
      originToCenter.y * normalizedDirection.y;
    const centerDistanceSquared =
      originToCenter.x * originToCenter.x + originToCenter.y * originToCenter.y;
    const discriminant =
      projection * projection - (centerDistanceSquared - headRadius * headRadius);

    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      const startT = -projection - root;
      const endT = -projection + root;

      const startPoint = {
        x: nosePoint.x + normalizedDirection.x * startT,
        y: nosePoint.y + normalizedDirection.y * startT,
      };
      const endPoint = {
        x: nosePoint.x + normalizedDirection.x * endT,
        y: nosePoint.y + normalizedDirection.y * endT,
      };

      drawCtx.beginPath();
      drawCtx.moveTo(startPoint.x, startPoint.y);
      drawCtx.lineTo(endPoint.x, endPoint.y);
      drawCtx.lineWidth = Math.max(2, headRadius * 0.14);
      drawCtx.strokeStyle = "rgba(59, 130, 246, 0.98)";
      drawCtx.stroke();
      drawCtx.strokeStyle = bodyColor;
    }
  }

  drawCtx.restore();

  canvasCtx.save();
  canvasCtx.globalAlpha = overlayAlpha;
  canvasCtx.drawImage(overlayCanvas, 0, 0);
  canvasCtx.restore();
};

const drawGuidanceBoneInRect = (
  canvasCtx: CanvasRenderingContext2D,
  rect: ProjectionRect,
  targetLandmarks: NormalizedLandmark[],
  evaluation: BoneEvaluation
) => {
  const targetStart = targetLandmarks[evaluation.startIndex];
  const targetEnd = targetLandmarks[evaluation.endIndex];
  if (!targetStart || !targetEnd) {
    return;
  }
  const projectPoint = (landmark: NormalizedLandmark) => ({
    x: rect.x + (1 - landmark.x) * rect.width,
    y: rect.y + landmark.y * rect.height,
  });
  const targetStartPoint = projectPoint(targetStart);
  const targetEndPoint = projectPoint(targetEnd);
  canvasCtx.save();
  canvasCtx.strokeStyle = "rgba(74, 222, 128, 0.95)";
  canvasCtx.lineWidth = 4;
  canvasCtx.beginPath();
  canvasCtx.moveTo(targetStartPoint.x, targetStartPoint.y);
  canvasCtx.lineTo(targetEndPoint.x, targetEndPoint.y);
  canvasCtx.stroke();

  canvasCtx.fillStyle = "rgba(74, 222, 128, 0.95)";
  canvasCtx.beginPath();
  canvasCtx.arc(targetEndPoint.x, targetEndPoint.y, 5, 0, Math.PI * 2);
  canvasCtx.fill();
  canvasCtx.restore();
};

const PoseCamera: React.FC<PoseCameraProps> = ({
  onSkeletonUpdate,
  onPhotoCaptured,
  onPoseMatchScoreUpdate,
  flashSignal,
  onPoseGuidanceUpdate,
  onRelativeDistanceGuidanceUpdate,
  callbackIntervalMs = 5000,
  showPoseStatus = false,
  showControls = true,
  targetPoseLandmarks,
  targetPoseWorldLandmarks,
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
  const poseGuidanceCallbackRef =
    useRef<PoseCameraProps["onPoseGuidanceUpdate"]>(onPoseGuidanceUpdate);
  const relativeDistanceCallbackRef =
    useRef<PoseCameraProps["onRelativeDistanceGuidanceUpdate"]>(
      onRelativeDistanceGuidanceUpdate
    );
  const callbackIntervalRef = useRef<number>(callbackIntervalMs);
  const lastCallbackTimeRef = useRef<number>(0);
  const lastScoreUpdateTimeRef = useRef<number>(0);
  const smoothedScaleRatioRef = useRef<number | null>(null);
  const lastRelativeDistanceGuidanceRef =
    useRef<RelativeDistanceGuidance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectPoseRef = useRef<() => void>(() => undefined);
  const flashOverlayRef = useRef<HTMLDivElement>(null);

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
  const [relativeDistanceGuidance, setRelativeDistanceGuidance] =
    useState<RelativeDistanceGuidance | null>(null);
  const [showModelSkeleton, setShowModelSkeleton] = useState(true);

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
    poseGuidanceCallbackRef.current = onPoseGuidanceUpdate;
  }, [onPoseGuidanceUpdate]);
  useEffect(() => {
    relativeDistanceCallbackRef.current = onRelativeDistanceGuidanceUpdate;
  }, [onRelativeDistanceGuidanceUpdate]);
  useEffect(() => {
    callbackIntervalRef.current = callbackIntervalMs;
  }, [callbackIntervalMs]);

  useEffect(() => {
    if (typeof flashSignal !== "number") {
      return;
    }

    const flashOverlay = flashOverlayRef.current;
    if (!flashOverlay) {
      return;
    }

    flashOverlay.style.transition = "none";
    flashOverlay.style.opacity = "0.65";

    const frameId = window.requestAnimationFrame(() => {
      flashOverlay.style.transition = "opacity 170ms ease-out";
      flashOverlay.style.opacity = "0";
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [flashSignal]);

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
    const userFrameLandmarks = landmarks[0];
    const hasNormalizedTarget =
      fittedTargetPoseLandmarks && isLikelyNormalizedLandmarks(fittedTargetPoseLandmarks);
    const normalizedGuidance =
      hasNormalizedTarget && userFrameLandmarks
        ? computePoseGuidance(userFrameLandmarks, fittedTargetPoseLandmarks)
        : { score: null, summary: null, highlightedBones: [] };
    const hasPose = landmarks.length > 0;
    setPoseDetected(hasPose);
    if (showTargetPoseOverlay && fittedTargetPoseLandmarks && fittedTargetPoseLandmarks.length > 0) {
      const mobileGuideRect = getCenteredMobileGuideRect(canvas.width, canvas.height);
      if (showModelSkeleton) {
        drawPoseLandmarkSetInRect(fittedTargetPoseLandmarks, canvasCtx, mobileGuideRect, {
          connectorColor: "rgba(56, 189, 248, 0.95)",
          pointColor: "rgba(125, 211, 252, 0.95)",
          lineWidth: 2,
          radius: 3,
        });
      }
      drawSoftBodyOverlayInRect(fittedTargetPoseLandmarks, canvasCtx, mobileGuideRect);

      if (userFrameLandmarks && normalizedGuidance.highlightedBones.length > 0) {
        for (const highlightedBone of normalizedGuidance.highlightedBones) {
          drawGuidanceBoneInRect(
            canvasCtx,
            mobileGuideRect,
            fittedTargetPoseLandmarks,
            highlightedBone
          );
        }
      }
    }
    if (hasPose) {
      const hasWorldTarget =
        targetPoseWorldLandmarks && targetPoseWorldLandmarks.length > 0;
      const userWorldLandmarks = result.worldLandmarks?.[0];
      const score = hasWorldTarget && userWorldLandmarks
        ? computePoseMatchScore(userWorldLandmarks, targetPoseWorldLandmarks)
        : normalizedGuidance.score;
      const relativeDistance =
        hasNormalizedTarget && userFrameLandmarks
          ? computeRelativeDistanceGuidance(
              userFrameLandmarks,
              fittedTargetPoseLandmarks,
              smoothedScaleRatioRef.current
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
        const guidanceCallback = poseGuidanceCallbackRef.current;
        if (guidanceCallback) {
          guidanceCallback(normalizedGuidance.summary);
        }
        if (relativeDistance) {
          smoothedScaleRatioRef.current = relativeDistance.smoothedRatio;
          lastRelativeDistanceGuidanceRef.current = relativeDistance.guidance;
          setRelativeDistanceGuidance(relativeDistance.guidance);
          const guidanceCallback = relativeDistanceCallbackRef.current;
          if (guidanceCallback) {
            guidanceCallback(relativeDistance.guidance);
          }
        } else if (lastRelativeDistanceGuidanceRef.current !== null) {
          smoothedScaleRatioRef.current = null;
          lastRelativeDistanceGuidanceRef.current = null;
          setRelativeDistanceGuidance(null);
          const guidanceCallback = relativeDistanceCallbackRef.current;
          if (guidanceCallback) {
            guidanceCallback(null);
          }
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
      const guidanceCallback = poseGuidanceCallbackRef.current;
      if (guidanceCallback) {
        guidanceCallback(null);
      }
      if (lastRelativeDistanceGuidanceRef.current !== null) {
        smoothedScaleRatioRef.current = null;
        lastRelativeDistanceGuidanceRef.current = null;
        setRelativeDistanceGuidance(null);
        const guidanceCallback = relativeDistanceCallbackRef.current;
        if (guidanceCallback) {
          guidanceCallback(null);
        }
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
        worldLandmarks: result.worldLandmarks ?? [],
        hasPose,
      });
    }
    scheduleNextFrame();
  }, [
    showTargetPoseOverlay,
    showModelSkeleton,
    fittedTargetPoseLandmarks,
    targetPoseWorldLandmarks,
    poseMatchScore,
  ]);
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
            {"  •  "}
            Distance: {relativeDistanceGuidance
              ? `${relativeDistanceGuidance.category} (${relativeDistanceGuidance.scaleRatio.toFixed(2)}x)`
              : "--"}
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

        <div ref={flashOverlayRef} style={styles.flashOverlay} />

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
              {showTargetPoseOverlay ? (
                <button
                  type="button"
                  onClick={() => setShowModelSkeleton((previous) => !previous)}
                  style={styles.controlButton}
                >
                  {showModelSkeleton ? "Hide Skeleton" : "Show Skeleton"}
                </button>
              ) : null}
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
