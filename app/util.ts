import * as THREE from "three";
import { Point3D } from "./types";


export function createBezierArrowBetweenPoints(
  pointA: Point3D,
  pointB: Point3D,
  color = 0xffffff,
  headLengthRatio = 0.15,
  headWidthRatio = 0.06,
  curvature = 0.3,
  tubeSegments = 40,
  tubeRadius = 0.01,
): THREE.Group | null {
  const posA = new THREE.Vector3(pointA.x, -pointA.y, -pointA.z);
  const posB = new THREE.Vector3(pointB.x, -pointB.y, -pointB.z);

  const length = posA.distanceTo(posB);
  if (length < 0.2) return null;

  // Midpoint of the straight line
  const mid = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);

  // Perpendicular offset: cross the direction with an up vector,
  // then fall back to a different axis if they're parallel
  const dir = new THREE.Vector3().subVectors(posB, posA).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(dir.dot(up)) > 0.99) up.set(1, 0, 0);
  const perp = new THREE.Vector3().crossVectors(dir, up).normalize();

  // Control point: midpoint shifted perpendicular by curvature × length
  const controlPoint = mid.clone().addScaledVector(perp, curvature * length);

  // Sample the quadratic Bézier into a CatmullRom curve
  const curve = new THREE.QuadraticBezierCurve3(posA, controlPoint, posB);

  // --- Tube (arrow shaft) ---
  // Stop the tube short so the cone doesn't overlap it
  const headLength = length * headLengthRatio;
  const shaftPoints = curve.getPoints(tubeSegments).slice(0, -Math.floor(tubeSegments * headLengthRatio) - 1);
  const shaftPath = new THREE.CatmullRomCurve3(shaftPoints);

  const tubeGeo = new THREE.TubeGeometry(shaftPath, tubeSegments, tubeRadius, 8, false);
  const mat = new THREE.MeshBasicMaterial({ color });
  const tube = new THREE.Mesh(tubeGeo, mat);

  // --- Cone (arrowhead) ---
  const headRadius = length * headWidthRatio;
  const coneGeo = new THREE.ConeGeometry(headRadius, headLength, 12);

  // Align cone to the tangent at the end of the curve
  const tangent = curve.getTangent(1);
  const cone = new THREE.Mesh(coneGeo, mat.clone());

  // ConeGeometry points along Y by default — rotate to match tangent
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);

  // Place cone tip at posB
  cone.position.copy(posB).addScaledVector(tangent, -headLength / 2);

  const group = new THREE.Group();
  group.add(tube, cone);
  return group;
}

export const MEDIAPIPE_CONNECTIONS: {
  start: number;
  end: number;
  radius: number;
}[] = [
  // Face
  { start: 0, end: 1, radius: 0.02 },
  { start: 1, end: 2, radius: 0.02 },
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

    const arrow = createBezierArrowBetweenPoints(pose[idx], reference[idx], color);
    if (arrow) group.add(arrow);
  });

  return group;
}

