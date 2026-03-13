import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type PoseSnapshot = {
  timestamp: number;
  landmarks: NormalizedLandmark[][];
  hasPose: boolean;
};

export type PoseCameraProps = {
  onSkeletonUpdate?: (snapshot: PoseSnapshot) => void;
  callbackIntervalMs?: number;
  showPoseStatus?: boolean;
  frameSize: {
    width: number;
    height: number;
  };
};
