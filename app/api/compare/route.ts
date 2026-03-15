import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type PoseLibraryJson = {
  pose?: string;
  landmarks?: Array<Array<{ x: number; y: number; z?: number; visibility?: number }>>;
  worldLandmarks?: Array<Array<{ x: number; y: number; z?: number; visibility?: number }>>;
};

type BoneDefinition = {
  key: string;
  label: string;
  startIndex: number;
  endIndex: number;
};

const BONE_DEFINITIONS: BoneDefinition[] = [
  { key: "clavicle", label: "Clavicle", startIndex: 11, endIndex: 12 },
  { key: "left_upper_arm", label: "Left upper arm", startIndex: 11, endIndex: 13 },
  { key: "right_upper_arm", label: "Right upper arm", startIndex: 12, endIndex: 14 },
  { key: "left_forearm", label: "Left forearm", startIndex: 13, endIndex: 15 },
  { key: "right_forearm", label: "Right forearm", startIndex: 14, endIndex: 16 },
  { key: "hips", label: "Hips", startIndex: 23, endIndex: 24 },
  { key: "left_upper_leg", label: "Left upper leg", startIndex: 23, endIndex: 25 },
  { key: "right_upper_leg", label: "Right upper leg", startIndex: 24, endIndex: 26 },
  { key: "left_lower_leg", label: "Left lower leg", startIndex: 25, endIndex: 27 },
  { key: "right_lower_leg", label: "Right lower leg", startIndex: 26, endIndex: 28 },
];

const POSE_LIBRARY_DIR = path.join(process.cwd(), "public", "pose-library");

const toTitle = (value: string) =>
  value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const listPoses = async () => {
  const files = await readdir(POSE_LIBRARY_DIR);
  const poseIds = files
    .filter((file) => /\.json$/i.test(file))
    .map((file) => file.replace(/\.json$/i, ""))
    .sort((first, second) => first.localeCompare(second, undefined, { numeric: true }));

  const poses = await Promise.all(
    poseIds.map(async (id) => {
      const filePath = path.join(POSE_LIBRARY_DIR, `${id}.json`);
      const rawFileContent = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(rawFileContent) as PoseLibraryJson;

      return {
        id,
        title: toTitle(id),
        image: `/pose-library/${parsed.pose ?? `${id}.png`}`,
      };
    })
  );

  return poses;
};

const loadPoseLandmarks = async (poseId: string, useWorldLandmarks: boolean) => {
  const filePath = path.join(POSE_LIBRARY_DIR, `${poseId}.json`);
  const rawFileContent = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(rawFileContent) as PoseLibraryJson;

  const preferred = useWorldLandmarks ? parsed.worldLandmarks?.[0] : parsed.landmarks?.[0];
  const fallback = useWorldLandmarks ? parsed.landmarks?.[0] : parsed.worldLandmarks?.[0];

  return preferred ?? fallback ?? null;
};

const getUnitBoneVector = (
  landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>,
  startIndex: number,
  endIndex: number,
  visibilityThreshold: number
) => {
  const start = landmarks[startIndex];
  const end = landmarks[endIndex];

  if (!start || !end) {
    return null;
  }

  const startVisibility = start.visibility ?? 1;
  const endVisibility = end.visibility ?? 1;
  if (startVisibility < visibilityThreshold || endVisibility < visibilityThreshold) {
    return null;
  }

  const rawVector = {
    x: end.x - start.x,
    y: end.y - start.y,
    z: (end.z ?? 0) - (start.z ?? 0),
  };

  const magnitude = Math.hypot(rawVector.x, rawVector.y, rawVector.z);
  if (magnitude <= 1e-8) {
    return null;
  }

  return {
    unit: {
      x: rawVector.x / magnitude,
      y: rawVector.y / magnitude,
      z: rawVector.z / magnitude,
    },
    raw: rawVector,
    magnitude,
  };
};

export async function GET() {
  try {
    const poses = await listPoses();

    return NextResponse.json({
      poses,
      bones: BONE_DEFINITIONS,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to list pose library files." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      modelPoseId?: string;
      userPoseId?: string;
      useWorldLandmarks?: boolean;
      visibilityThreshold?: number;
    };

    if (!body.modelPoseId || !body.userPoseId) {
      return NextResponse.json(
        { error: "modelPoseId and userPoseId are required." },
        { status: 400 }
      );
    }

    const useWorldLandmarks = Boolean(body.useWorldLandmarks);
    const visibilityThreshold =
      typeof body.visibilityThreshold === "number"
        ? Math.max(0, Math.min(1, body.visibilityThreshold))
        : 0.6;

    const [modelLandmarks, userLandmarks] = await Promise.all([
      loadPoseLandmarks(body.modelPoseId, useWorldLandmarks),
      loadPoseLandmarks(body.userPoseId, useWorldLandmarks),
    ]);

    if (!modelLandmarks || !userLandmarks) {
      return NextResponse.json(
        { error: "Could not load landmarks from one or both selected poses." },
        { status: 400 }
      );
    }

    let modelPresentBoneCount = 0;
    let includedBoneCount = 0;
    let weightedContributionSum = 0;

    const perBone = BONE_DEFINITIONS.map((bone) => {
      const modelVector = getUnitBoneVector(
        modelLandmarks,
        bone.startIndex,
        bone.endIndex,
        visibilityThreshold
      );
      const userVector = getUnitBoneVector(
        userLandmarks,
        bone.startIndex,
        bone.endIndex,
        visibilityThreshold
      );

      const modelPresent = modelVector !== null;
      const userPresent = userVector !== null;

      if (modelPresent) {
        modelPresentBoneCount += 1;
      }

      if (!modelVector || !userVector) {
        return {
          ...bone,
          modelPresent,
          userPresent,
          included: false,
          cosineSimilarity: null,
          contributionPercent: 0,
          modelRawVector: modelVector?.raw ?? null,
          userRawVector: userVector?.raw ?? null,
          modelUnitVector: modelVector?.unit ?? null,
          userUnitVector: userVector?.unit ?? null,
          modelMagnitude: modelVector?.magnitude ?? null,
          userMagnitude: userVector?.magnitude ?? null,
        };
      }

      const cosineSimilarity =
        userVector.unit.x * modelVector.unit.x +
        userVector.unit.y * modelVector.unit.y +
        userVector.unit.z * modelVector.unit.z;

      const clampedSimilarity = Math.max(-1, Math.min(1, cosineSimilarity));
      const contributionPercent = ((clampedSimilarity + 1) / 2) * 100;

      includedBoneCount += 1;
      weightedContributionSum += (clampedSimilarity + 1) / 2;

      return {
        ...bone,
        modelPresent,
        userPresent,
        included: true,
        cosineSimilarity: clampedSimilarity,
        contributionPercent,
        modelRawVector: modelVector.raw,
        userRawVector: userVector.raw,
        modelUnitVector: modelVector.unit,
        userUnitVector: userVector.unit,
        modelMagnitude: modelVector.magnitude,
        userMagnitude: userVector.magnitude,
      };
    });

    const score =
      modelPresentBoneCount > 0
        ? Math.round((weightedContributionSum / modelPresentBoneCount) * 100)
        : null;

    return NextResponse.json({
      modelPoseId: body.modelPoseId,
      userPoseId: body.userPoseId,
      useWorldLandmarks,
      visibilityThreshold,
      summary: {
        score,
        modelPresentBoneCount,
        includedBoneCount,
        totalBoneCount: BONE_DEFINITIONS.length,
        missingUserBonesPenaltyCount: modelPresentBoneCount - includedBoneCount,
      },
      perBone,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to compare selected poses." },
      { status: 500 }
    );
  }
}
