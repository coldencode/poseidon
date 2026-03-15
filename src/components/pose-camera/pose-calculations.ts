import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type {
  PoseGuidanceAdjustment,
  PoseGuidanceSummary,
  RelativeDistanceGuidance,
} from "@/app/types";

const BONE_VISIBILITY_THRESHOLD = 0.5;
const GUIDANCE_WARNING_SIMILARITY_THRESHOLD = 0.8;

type LimbBoneDefinition = {
  key: string;
  label: string;
  startIndex: number;
  endIndex: number;
};

const LIMB_BONE_DEFINITIONS: LimbBoneDefinition[] = [
  { key: "left_upper_arm", label: "Left upper arm", startIndex: 12, endIndex: 14 },
  { key: "right_upper_arm", label: "Right upper arm", startIndex: 11, endIndex: 13 },
  { key: "left_forearm", label: "Left forearm", startIndex: 14, endIndex: 16 },
  { key: "right_forearm", label: "Right forearm", startIndex: 13, endIndex: 15 },
  { key: "left_upper_leg", label: "Left upper leg", startIndex: 23, endIndex: 25 },
  { key: "right_upper_leg", label: "Right upper leg", startIndex: 24, endIndex: 26 },
  { key: "left_lower_leg", label: "Left lower leg", startIndex: 25, endIndex: 27 },
  { key: "right_lower_leg", label: "Right lower leg", startIndex: 26, endIndex: 28 },
];

const RELATIVE_SCALE_SPECS = [
  [11, 12],
  [23, 24],
  [11, 23],
  [12, 24],
] as const;

const DISTANCE_SMOOTHING_ALPHA = 0.22;
const DISTANCE_RATIO_TOO_CLOSE_THRESHOLD = 1.12;
const DISTANCE_RATIO_TOO_FAR_THRESHOLD = 0.88;

export type BoneEvaluation = {
  key: string;
  label: string;
  similarity: number;
  startIndex: number;
  endIndex: number;
  deltaX: number;
  deltaY: number;
};

export type GuidanceComputation = {
  score: number | null;
  summary: PoseGuidanceSummary | null;
  highlightedBones: BoneEvaluation[];
};

export const isLikelyNormalizedLandmarks = (landmarks: NormalizedLandmark[]) =>
  landmarks.every((landmark) => landmark.x >= 0 && landmark.x <= 1 && landmark.y >= 0 && landmark.y <= 1);

const getAdjustmentMessage = (boneLabel: string, deltaX: number, deltaY: number) => {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absY >= absX) {
    if (deltaY < -0.02) {
      return `Raise ${boneLabel.toLowerCase()}`;
    }
    if (deltaY > 0.02) {
      return `Lower ${boneLabel.toLowerCase()}`;
    }
  } else {
    if (deltaX > 0.02) {
      return `Move ${boneLabel.toLowerCase()} outward`;
    }
    if (deltaX < -0.02) {
      return `Move ${boneLabel.toLowerCase()} inward`;
    }
  }

  return `Fine-tune ${boneLabel.toLowerCase()}`;
};

const getBoneVector = (
  landmarks: NormalizedLandmark[],
  startIndex: number,
  endIndex: number,
  visibilityThreshold = BONE_VISIBILITY_THRESHOLD
) => {
  const startPoint = landmarks[startIndex];
  const endPoint = landmarks[endIndex];

  if (!startPoint || !endPoint) {
    return null;
  }

  const startVisibility = startPoint.visibility ?? 1;
  const endVisibility = endPoint.visibility ?? 1;

  if (startVisibility < visibilityThreshold || endVisibility < visibilityThreshold) {
    return null;
  }

  const rawVector = {
    x: endPoint.x - startPoint.x,
    y: endPoint.y - startPoint.y,
    z: (endPoint.z ?? 0) - (startPoint.z ?? 0),
  };

  const magnitude = Math.hypot(rawVector.x, rawVector.y, rawVector.z);
  if (magnitude <= 1e-8) {
    return null;
  }

  return {
    x: rawVector.x / magnitude,
    y: rawVector.y / magnitude,
    z: rawVector.z / magnitude,
  };
};

const calculateCosineSimilarity = (
  vectorA: { x: number; y: number; z: number },
  vectorB: { x: number; y: number; z: number }
) => {
  const dotProduct =
    vectorA.x * vectorB.x +
    vectorA.y * vectorB.y +
    vectorA.z * vectorB.z;

  return Math.max(-1, Math.min(1, dotProduct));
};

const evaluateLimbBones = (
  userLandmarks: NormalizedLandmark[],
  referenceLandmarks: NormalizedLandmark[]
) => {
  const evaluations: BoneEvaluation[] = [];

  for (const limb of LIMB_BONE_DEFINITIONS) {
    const userVector = getBoneVector(
      userLandmarks,
      limb.startIndex,
      limb.endIndex
    );
    const referenceVector = getBoneVector(
      referenceLandmarks,
      limb.startIndex,
      limb.endIndex
    );

    if (!userVector || !referenceVector) {
      continue;
    }

    const similarity = calculateCosineSimilarity(userVector, referenceVector);
    if (similarity === null || !Number.isFinite(similarity)) {
      continue;
    }

    const userEnd = userLandmarks[limb.endIndex];
    const referenceEnd = referenceLandmarks[limb.endIndex];
    const deltaX = userEnd && referenceEnd ? referenceEnd.x - userEnd.x : 0;
    const deltaY = userEnd && referenceEnd ? referenceEnd.y - userEnd.y : 0;

    evaluations.push({
      key: limb.key,
      label: limb.label,
      similarity,
      startIndex: limb.startIndex,
      endIndex: limb.endIndex,
      deltaX,
      deltaY,
    });
  }

  return evaluations;
};

export const computePoseMatchScore = (
  userLandmarks: NormalizedLandmark[],
  referenceLandmarks: NormalizedLandmark[]
) => {
  let modelPresentBoneCount = 0;
  let weightedContributionSum = 0;

  for (const bone of LIMB_BONE_DEFINITIONS) {
    const referenceVector = getBoneVector(
      referenceLandmarks,
      bone.startIndex,
      bone.endIndex
    );

    if (!referenceVector) {
      continue;
    }

    modelPresentBoneCount += 1;

    const userVector = getBoneVector(
      userLandmarks,
      bone.startIndex,
      bone.endIndex
    );

    if (!userVector) {
      continue;
    }

    const similarity = calculateCosineSimilarity(userVector, referenceVector);
    if (similarity === null || !Number.isFinite(similarity)) {
      continue;
    }

    weightedContributionSum += (similarity + 1) / 2;
  }

  if (modelPresentBoneCount === 0) {
    return null;
  }

  return Math.round((weightedContributionSum / modelPresentBoneCount) * 100);
};

export const computePoseGuidance = (
  userLandmarks: NormalizedLandmark[],
  referenceLandmarks: NormalizedLandmark[]
): GuidanceComputation => {
  const evaluations = evaluateLimbBones(userLandmarks, referenceLandmarks);

  if (evaluations.length === 0) {
    return {
      score: null,
      summary: null,
      highlightedBones: [],
    };
  }

  const score = Math.round(
    ((
      evaluations.reduce((sum, evaluation) => sum + evaluation.similarity, 0) /
      evaluations.length
    ) +
      1) /
      2 *
      100
  );

  const sortedAdjustments = [...evaluations].sort(
    (left, right) => left.similarity - right.similarity
  );

  const topAdjustments = sortedAdjustments.filter(
    (evaluation) => evaluation.similarity < GUIDANCE_WARNING_SIMILARITY_THRESHOLD
  );

  const accurateHighlights = [...evaluations]
    .filter(
      (evaluation) => evaluation.similarity >= GUIDANCE_WARNING_SIMILARITY_THRESHOLD
    )
    .sort((left, right) => right.similarity - left.similarity);

  const adjustmentMessages: PoseGuidanceAdjustment[] = topAdjustments.map(
    (evaluation) => ({
      limb: evaluation.label,
      similarity: evaluation.similarity,
      message: getAdjustmentMessage(evaluation.label, evaluation.deltaX, evaluation.deltaY),
    })
  );

  const summary: PoseGuidanceSummary = {
    confidence: Math.round((evaluations.length / LIMB_BONE_DEFINITIONS.length) * 100),
    coveredBones: evaluations.length,
    totalBones: LIMB_BONE_DEFINITIONS.length,
    primaryInstruction:
      adjustmentMessages.length > 0
        ? adjustmentMessages[0].message
        : "Great alignment — hold the pose steady.",
    topAdjustments: adjustmentMessages,
  };

  return {
    score,
    summary,
    highlightedBones: accurateHighlights,
  };
};

const calculateLandmarkDistance = (
  pointA: NormalizedLandmark,
  pointB: NormalizedLandmark
) => {
  const deltaX = pointA.x - pointB.x;
  const deltaY = pointA.y - pointB.y;
  const deltaZ = (pointA.z ?? 0) - (pointB.z ?? 0);
  return Math.hypot(deltaX, deltaY, deltaZ);
};

const computePoseScaleMagnitude = (landmarks: NormalizedLandmark[]) => {
  const measuredSegments: number[] = [];

  for (const [startIndex, endIndex] of RELATIVE_SCALE_SPECS) {
    const startPoint = landmarks[startIndex];
    const endPoint = landmarks[endIndex];

    if (!startPoint || !endPoint) {
      continue;
    }

    const distance = calculateLandmarkDistance(startPoint, endPoint);
    if (Number.isFinite(distance) && distance > 1e-6) {
      measuredSegments.push(distance);
    }
  }

  if (measuredSegments.length === 0) {
    return null;
  }

  return measuredSegments.reduce((sum, value) => sum + value, 0) / measuredSegments.length;
};

const getDistanceCategory = (
  scaleRatio: number
): RelativeDistanceGuidance["category"] => {
  if (scaleRatio > DISTANCE_RATIO_TOO_CLOSE_THRESHOLD) {
    return "Too Close";
  }

  if (scaleRatio < DISTANCE_RATIO_TOO_FAR_THRESHOLD) {
    return "Too Far";
  }

  return "Good Distance";
};

export const computeRelativeDistanceGuidance = (
  userLandmarks: NormalizedLandmark[],
  referenceLandmarks: NormalizedLandmark[],
  previousSmoothedRatio: number | null
) => {
  const userScale = computePoseScaleMagnitude(userLandmarks);
  const referenceScale = computePoseScaleMagnitude(referenceLandmarks);

  if (
    userScale === null ||
    referenceScale === null ||
    !Number.isFinite(userScale) ||
    !Number.isFinite(referenceScale) ||
    referenceScale <= 1e-6
  ) {
    return null;
  }

  const rawRatio = userScale / referenceScale;
  const smoothedRatio =
    previousSmoothedRatio === null
      ? rawRatio
      : previousSmoothedRatio +
        DISTANCE_SMOOTHING_ALPHA * (rawRatio - previousSmoothedRatio);

  return {
    guidance: {
      scaleRatio: Math.max(0, smoothedRatio),
      category: getDistanceCategory(smoothedRatio),
    } satisfies RelativeDistanceGuidance,
    smoothedRatio,
  };
};
