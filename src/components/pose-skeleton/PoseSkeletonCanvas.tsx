"use client";

import { useEffect, useRef } from "react";
import {
  PoseLandmarker,
  DrawingUtils,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

function toNormalizedLandmark(l: unknown): NormalizedLandmark {
  const o = l as Record<string, number>;
  return {
    x: Number(o?.x ?? 0),
    y: Number(o?.y ?? 0),
    z: Number(o?.z ?? 0),
    visibility: Number(o?.visibility ?? 1),
  };
}

type Props = {
  imageSrc: string;
  landmarks: unknown[][] | null;
  className?: string;
};

export default function PoseSkeletonCanvas({
  imageSrc,
  landmarks,
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);

      if (landmarks && Array.isArray(landmarks) && landmarks.length > 0) {
        const poseLandmarks = (landmarks[0] as unknown[]).map(toNormalizedLandmark);
        const drawingUtils = new DrawingUtils(ctx);
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
    img.src = imageSrc.startsWith("/") ? imageSrc : `/${imageSrc}`;
  }, [imageSrc, landmarks]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ maxWidth: "100%", height: "auto", display: "block" }}
    />
  );
}
