import * as THREE from "three";
import { Point3D } from "./types";

export function createArrowBetweenPoints(
  pointA: Point3D,
  pointB: Point3D,
  color = 0xffffff,
  headLengthRatio = 0.2,
  headWidthRatio = 0.1,
): THREE.ArrowHelper {
  const posA = new THREE.Vector3(pointA.x, -pointA.y, pointA.z);
  const posB = new THREE.Vector3(pointB.x, -pointB.y, pointB.z);

  const direction = new THREE.Vector3().subVectors(posB, posA).normalize();
  const length = posA.distanceTo(posB);

  return new THREE.ArrowHelper(
    direction,
    posA,
    length,
    color,
    length * headLengthRatio,
    length * headWidthRatio,
  );
}

export const MEDIAPIPE_CONNECTIONS: {
  start: number;
  end: number;
  radius: number;
}[] = [
  // Face
    { start: 0, end: 1, radius: 0.02 },
    { start: 1, end: 2, radius: 0.02 },
  //   { start: 2, end: 3, radius: 0.02 },
  //   { start: 3, end: 7, radius: 0.02 },
  //   { start: 0, end: 4, radius: 0.02 },
  //   { start: 4, end: 5, radius: 0.02 },
  //   { start: 5, end: 6, radius: 0.02 },
  //   { start: 6, end: 8, radius: 0.02 },
    { start: 9, end: 10, radius: 0.025 }, // mouth

  // Torso (thickest)
  { start: 11, end: 12, radius: 0.02 }, // shoulders
  { start: 11, end: 23, radius: 0.02 }, // left side torso
  { start: 12, end: 24, radius: 0.02 }, // right side torso
  { start: 23, end: 24, radius: 0.02 }, // hips


  // Arms
  { start: 11, end: 13, radius: 0.02 }, // left upper arm
  { start: 13, end: 15, radius: 0.012 }, // left forearm
  { start: 12, end: 14, radius: 0.02 }, // right upper arm
  { start: 14, end: 16, radius: 0.012 }, // right forearm

  // Hands
//   { start: 15, end: 17, radius: 0.018 },
//   { start: 15, end: 19, radius: 0.018 },
//   { start: 15, end: 21, radius: 0.018 },
//   { start: 17, end: 19, radius: 0.015 },
//   { start: 16, end: 18, radius: 0.018 },
//   { start: 16, end: 20, radius: 0.018 },
//   { start: 16, end: 22, radius: 0.018 },
//   { start: 18, end: 20, radius: 0.015 },

  // Legs
  { start: 23, end: 25, radius: 0.03 }, // left thigh
  { start: 25, end: 27, radius: 0.022 }, // left shin
  { start: 24, end: 26, radius: 0.03 }, // right thigh
  { start: 26, end: 28, radius: 0.022 }, // right shin

  // Feet
  { start: 27, end: 29, radius: 0.01 },
  { start: 27, end: 31, radius: 0.01 },
  { start: 29, end: 31, radius: 0.01 },
  { start: 28, end: 30, radius: 0.01 },
  { start: 28, end: 32, radius: 0.01 },
  { start: 30, end: 32, radius: 0.01 },
];
export function createDifferenceArrows(
  pose: Point3D[],
  reference: Point3D[],
  color = 0xffffff,
): THREE.Group {
  const group = new THREE.Group();

  // Left hand (15), Right hand (16), Left foot (31), Right foot (32)
  const landmarks = [15, 16, 31, 32];

  landmarks.forEach((idx) => {
    if (idx >= pose.length || idx >= reference.length) return;
    const arrow = createArrowBetweenPoints(pose[idx], reference[idx], color);
    group.add(arrow);
  });

  return group;
}