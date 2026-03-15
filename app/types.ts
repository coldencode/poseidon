import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type PoseSnapshot = {
  timestamp: number;
  landmarks: NormalizedLandmark[][];
  hasPose: boolean;
};

export type RelativeDistanceGuidance = {
  scaleRatio: number;
  category: "Too Close" | "Good Distance" | "Too Far";
};

export type PoseGuidanceAdjustment = {
  limb: string;
  similarity: number;
  message: string;
};

export type PoseGuidanceSummary = {
  confidence: number;
  coveredBones: number;
  totalBones: number;
  primaryInstruction: string;
  topAdjustments: PoseGuidanceAdjustment[];
};

export type PoseCameraProps = {
  onSkeletonUpdate?: (snapshot: PoseSnapshot) => void;
  onPhotoCaptured?: (imageDataUrl: string) => void;
  onPoseMatchScoreUpdate?: (score: number | null) => void;
  onPoseGuidanceUpdate?: (guidance: PoseGuidanceSummary | null) => void;
  onRelativeDistanceGuidanceUpdate?: (
    guidance: RelativeDistanceGuidance | null
  ) => void;
  callbackIntervalMs?: number;
  showPoseStatus?: boolean;
  showControls?: boolean;
  targetPoseLandmarks?: NormalizedLandmark[];
  targetPoseWorldLandmarks?: NormalizedLandmark[];
  showTargetPoseOverlay?: boolean;
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
