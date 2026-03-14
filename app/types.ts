import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type PoseSnapshot = {
  timestamp: number;
  landmarks: NormalizedLandmark[][];
  hasPose: boolean;
};

export type PoseCameraProps = {
  onSkeletonUpdate?: (snapshot: PoseSnapshot) => void;
  onPhotoCaptured?: (imageDataUrl: string) => void;
  callbackIntervalMs?: number;
  showPoseStatus?: boolean;
  showControls?: boolean;
  frameSize: {
    width: number;
    height: number;
  };
};


export interface Point3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface Connection {
    start: number;
    end: number;
}

export type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

export type Pose = {
  pose: string;
  landmarks: Landmark[][];
  worldLandmarks: Landmark[][];
  hasPose: boolean;
};
