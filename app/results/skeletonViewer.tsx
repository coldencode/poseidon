
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Point3D, Connection } from "../types";
import { createDifferenceArrows, MEDIAPIPE_CONNECTIONS } from "../util";

export interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Group;
  isDragging: boolean;
  lastX: number;
  lastY: number;
  autoRotate: boolean;
}
function buildSkeleton(
  pts: Point3D[],
  color: number,
  offsetX: number,
  showSkeleton: boolean,
  showVolumes: boolean,
  modelRole: "user" | "reference",
  prioritizeReferenceOnOverlap: boolean,
) {
  const group = new THREE.Group();

  if (!pts || pts.length === 0) return group;
  const skeletonMat = new THREE.MeshPhongMaterial({ color });
  const boneMat = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity: 0.5,
  });
  const volumeMat = new THREE.MeshPhongMaterial({
    color,
    transparent: false,
    opacity: 1,
    shininess: 55,
  });
  const isReferenceModel = modelRole === "reference";
  const userVolumeMat = volumeMat.clone();
  userVolumeMat.color.set(0xcbd5e1);
  userVolumeMat.transparent = true;
  userVolumeMat.opacity = 0.35;
  userVolumeMat.stencilWrite = true;
  userVolumeMat.stencilRef = 1;
  userVolumeMat.stencilFunc = THREE.AlwaysStencilFunc;
  userVolumeMat.stencilFail = THREE.KeepStencilOp;
  userVolumeMat.stencilZFail = THREE.KeepStencilOp;
  userVolumeMat.stencilZPass = THREE.ReplaceStencilOp;

  const referenceBaseVolumeMat = volumeMat.clone();
  const referenceOverlapVolumeMat = volumeMat.clone();
  referenceOverlapVolumeMat.transparent = false;
  referenceOverlapVolumeMat.opacity = 1;
  referenceOverlapVolumeMat.depthTest = false;
  referenceOverlapVolumeMat.depthWrite = false;
  referenceOverlapVolumeMat.stencilWrite = true;
  referenceOverlapVolumeMat.stencilRef = 1;
  referenceOverlapVolumeMat.stencilFunc = THREE.EqualStencilFunc;
  referenceOverlapVolumeMat.stencilFail = THREE.KeepStencilOp;
  referenceOverlapVolumeMat.stencilZFail = THREE.KeepStencilOp;
  referenceOverlapVolumeMat.stencilZPass = THREE.KeepStencilOp;

  const primaryVolumeMat = isReferenceModel
    ? referenceBaseVolumeMat
    : userVolumeMat;

  const addVolumeMesh = (mesh: THREE.Mesh) => {
    group.add(mesh);

    if (isReferenceModel && prioritizeReferenceOnOverlap) {
      const overlapMesh = mesh.clone();
      overlapMesh.material = referenceOverlapVolumeMat;
      overlapMesh.renderOrder = 3;
      group.add(overlapMesh);
    }
  };
  if (!pts || pts.length === 0 || !pts[0]) {
    return group;
  }
  const head = pts[0];
  if (
    !head ||
    typeof head.x !== "number" ||
    typeof head.y !== "number" ||
    typeof head.z !== "number"
  )
    return group;

  if (showVolumes) {
    const headPos = new THREE.Vector3(pts[0].x + offsetX, -pts[0].y, -pts[0].z);
    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 16),
      primaryVolumeMat,
    );
    headMesh.position.copy(headPos);
    addVolumeMesh(headMesh);
  }

  const getPoint = (index: number): THREE.Vector3 | null => {
    const point = pts[index];
    if (!point) return null;
    if (
      typeof point.x !== "number" ||
      typeof point.y !== "number" ||
      typeof point.z !== "number"
    ) {
      return null;
    }

    return new THREE.Vector3(point.x + offsetX, -point.y, -point.z);
  };

  const addLimbVolume = (
    startIndex: number,
    endIndex: number,
    startRadius: number,
    endRadius: number,
  ) => {
    const startPoint = getPoint(startIndex);
    const endPoint = getPoint(endIndex);

    if (!startPoint || !endPoint) {
      return;
    }

    const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
    const length = direction.length();
    if (length <= 1e-6) {
      return;
    }

    const midpoint = new THREE.Vector3()
      .addVectors(startPoint, endPoint)
      .multiplyScalar(0.5);

    const limb = new THREE.Mesh(
      new THREE.CylinderGeometry(endRadius, startRadius, length, 16),
      primaryVolumeMat,
    );
    limb.position.copy(midpoint);
    limb.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );

    addVolumeMesh(limb);
  };

  const addTorsoVolume = () => {
    const leftShoulder = getPoint(11);
    const rightShoulder = getPoint(12);
    const leftHip = getPoint(23);
    const rightHip = getPoint(24);

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      return;
    }

    const shoulderMid = new THREE.Vector3()
      .addVectors(leftShoulder, rightShoulder)
      .multiplyScalar(0.5);
    const hipMid = new THREE.Vector3()
      .addVectors(leftHip, rightHip)
      .multiplyScalar(0.5);

    const center = new THREE.Vector3()
      .addVectors(shoulderMid, hipMid)
      .multiplyScalar(0.5);

    const rightAxis = new THREE.Vector3().subVectors(rightShoulder, leftShoulder);
    const upAxis = new THREE.Vector3().subVectors(shoulderMid, hipMid);

    if (rightAxis.lengthSq() <= 1e-6 || upAxis.lengthSq() <= 1e-6) {
      return;
    }

    rightAxis.normalize();
    let forwardAxis = new THREE.Vector3().crossVectors(rightAxis, upAxis);

    if (forwardAxis.lengthSq() <= 1e-6) {
      forwardAxis = new THREE.Vector3(0, 0, 1);
    } else {
      forwardAxis.normalize();
    }

    const fixedUpAxis = new THREE.Vector3()
      .crossVectors(forwardAxis, rightAxis)
      .normalize();

    const torsoWidth = Math.max(0.16, leftShoulder.distanceTo(rightShoulder) * 1.2);
    const torsoHeight = Math.max(0.22, shoulderMid.distanceTo(hipMid) * 1.2);
    const torsoDepth = Math.max(0.14, torsoWidth * 0.55);

    const torsoRadius = Math.max(0.075, Math.min(torsoWidth, torsoHeight) * 0.23);
    const torsoCoreHeight = Math.max(0.02, torsoHeight - torsoRadius * 2);
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(torsoRadius, torsoCoreHeight, 8, 18),
      primaryVolumeMat,
    );
    torso.position.copy(center);

    const torsoDiameter = torsoRadius * 2;
    const torsoScaleX = Math.max(0.9, torsoWidth / torsoDiameter);
    const torsoScaleZ = Math.max(0.6, torsoDepth / torsoDiameter);
    torso.scale.set(torsoScaleX, 1, torsoScaleZ);

    const orientation = new THREE.Matrix4().makeBasis(
      rightAxis,
      fixedUpAxis,
      forwardAxis,
    );
    torso.quaternion.setFromRotationMatrix(orientation);
    addVolumeMesh(torso);
  };

  if (showSkeleton) {
    MEDIAPIPE_CONNECTIONS.forEach(({ start, end, radius }) => {
      if (start >= pts.length || end >= pts.length) return;
      const pA = new THREE.Vector3(
        pts[start].x + offsetX,
        -pts[start].y,
        -pts[start].z,
      );
      const pB = new THREE.Vector3(
        pts[end].x + offsetX,
        -pts[end].y,
        -pts[end].z,
      );
      const dir = new THREE.Vector3().subVectors(pB, pA);
      const len = dir.length();
      const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
      const bone = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, len, 8),
        boneMat,
      );
      bone.position.copy(mid);
      bone.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.clone().normalize(),
      );
      group.add(bone);
    });
  }

  if (showVolumes) {
    addTorsoVolume();
    addLimbVolume(11, 13, 0.07, 0.055);
    addLimbVolume(13, 15, 0.055, 0.042);
    addLimbVolume(12, 14, 0.07, 0.055);
    addLimbVolume(14, 16, 0.055, 0.042);
    addLimbVolume(23, 25, 0.082, 0.065);
    addLimbVolume(25, 27, 0.065, 0.05);
    addLimbVolume(24, 26, 0.082, 0.065);
    addLimbVolume(26, 28, 0.065, 0.05);
  }

  return group;
}

export default function SkeletonViewer({
  pose,
  referencePose,
}: {
  pose?: Point3D[];
  referencePose?: Point3D[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<Partial<SceneState>>({});
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showPose, setShowPose] = useState<boolean>(true);
  const [showReference, setShowReference] = useState<boolean>(true);
  const [showArrows, setShowArrows] = useState<boolean>(false);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      stencil: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    const container = canvas.parentElement?.parentElement;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    const scene = new THREE.Scene();
    // Light background color
    scene.background = new THREE.Color(0xf8fafc);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    camera.position.set(0, 0, 3.5);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(1, 2, 3);
    scene.add(dir);

    // Dot grid — dark dots on light background
    const dotGeometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const spacing = 0.3;
    const gridSize = 10;
    for (let x = -gridSize; x <= gridSize; x++) {
      for (let y = -gridSize; y <= gridSize; y++) {
        positions.push(x * spacing, y * spacing, -2);
      }
    }
    dotGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    const dotMaterial = new THREE.PointsMaterial({
      color: "#94a3b8",
      sizeAttenuation: false,
      size: 2,
      opacity: 0.4,
      transparent: true,
    });
    scene.add(new THREE.Points(dotGeometry, dotMaterial));
    const pivot = new THREE.Group();

    if (referencePose && pose) {
      const prioritizeReferenceOnOverlap = showReference && showPose;
      const poseSkeleton = buildSkeleton(
        pose,
        0x2563eb,
        0,
        showSkeleton,
        true,
        "user",
        prioritizeReferenceOnOverlap,
      );

      const refSkeleton = buildSkeleton(
        referencePose,
        0xea580c,
        0,
        showSkeleton,
        true,
        "reference",
        prioritizeReferenceOnOverlap,
      );
      if (showReference) pivot.add(refSkeleton);
      if (!showReference) pivot.remove(refSkeleton);
      const arrows = createDifferenceArrows(pose, referencePose, 0x475569);
      if (showArrows) {
        pivot.add(arrows);
      } else {
        pivot.remove(arrows);
      }
      if (showPose) pivot.add(poseSkeleton);
      if (!showPose) pivot.remove(poseSkeleton);
    }

    scene.add(pivot);
    stateRef.current = {
      renderer,
      scene,
      camera,
      pivot,
      isDragging: false,
      lastX: 0,
      lastY: 0,
    };

    const getXY = (e: MouseEvent | TouchEvent): [number, number] =>
      "touches" in e
        ? [e.touches[0].clientX, e.touches[0].clientY]
        : [e.clientX, e.clientY];
    const onDown = (e: MouseEvent | TouchEvent) => {
      const s = stateRef.current;
      s.isDragging = true;
      [s.lastX, s.lastY] = getXY(e);
    };
    const onUp = () => {
      stateRef.current.isDragging = false;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      const s = stateRef.current;
      if (!s.isDragging || !s.pivot) return;
      const [x, y] = getXY(e);
      s.pivot.rotation.y += (x - (s.lastX ?? 0)) * 0.01;
      s.pivot.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, s.pivot.rotation.x + (y - (s.lastY ?? 0)) * 0.01),
      );
      [s.lastX, s.lastY] = [x, y];
    };
    const onWheel = (e: WheelEvent) => {
      if (!stateRef.current.camera) return;
      stateRef.current.camera.position.z = Math.max(
        1,
        Math.min(8, stateRef.current.camera.position.z + e.deltaY * 0.005),
      );
      e.preventDefault();
    };
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onUp);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("touchstart", onDown);
    canvas.addEventListener("touchend", onUp);
    canvas.addEventListener("touchmove", onMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    let raf: number;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const s = stateRef.current;
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      if (!s.isDragging && s.autoRotate && s.pivot) s.pivot.rotation.y += 0.004;
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseleave", onUp);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchend", onUp);
      canvas.removeEventListener("touchmove", onMove);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [showPose, showReference, showArrows, showSkeleton]);
  useEffect(() => {
    const s = stateRef.current;
    if (!s.pivot) return;

    // Remove old skeleton groups (keep dots/lights which are index 0,1)
    const toRemove = s.pivot.children.slice();
    toRemove.forEach((child) => s.pivot!.remove(child));

    if (referencePose && pose) {
      const prioritizeReferenceOnOverlap = showReference && showPose;
      const poseSkeleton = buildSkeleton(
        pose,
        0x2563eb,
        0,
        showSkeleton,
        true,
        "user",
        prioritizeReferenceOnOverlap,
      );
      const refSkeleton = buildSkeleton(
        referencePose,
        0xea580c,
        0,
        showSkeleton,
        true,
        "reference",
        prioritizeReferenceOnOverlap,
      );
      const arrows = createDifferenceArrows(pose, referencePose, 0x475569);

      if (showPose) s.pivot.add(poseSkeleton);
      if (showReference) s.pivot.add(refSkeleton);
      if (showArrows) s.pivot.add(arrows);
    }
  }, [pose, referencePose, showPose, showReference, showArrows, showSkeleton]);
  useEffect(() => {
    stateRef.current.autoRotate = autoRotate;
  }, [autoRotate]);
  return (
    <div className="w-full h-full">
      <div className="relative w-full h-full overflow-hidden">
        <canvas ref={canvasRef} className="block" />
        {/* Legend */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "flex",
            gap: 8,
          }}
        >
          {[
            ["#2563eb", "Your Pose", showPose, () => setShowPose((p) => !p)],
            [
              "#ea580c",
              "Reference Pose",
              showReference,
              () => setShowReference((p) => !p),
            ],
            [
              "#64748b",
              "Skeleton",
              showSkeleton,
              () => setShowSkeleton((p) => !p),
            ],
            ["#475569", "Arrows", showArrows, () => setShowArrows((p) => !p)],
          ].map(([color, label, visible, toggle]) => (
            <div
              key={label as string}
              onClick={toggle as () => void}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(0,0,0,0.05)",
                border: `0.5px solid ${visible ? (color as string) : "rgba(0,0,0,0.15)"}`,
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 13,
                color: visible ? "#1e293b" : "rgba(0,0,0,0.35)",
                cursor: "pointer",
                userSelect: "none",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: color as string,
                  opacity: visible ? 1 : 0.3,
                }}
              />
              {label as string}
            </div>
          ))}
        </div>
        {/* Controls */}
        <div style={{ position: "absolute", bottom: 12, right: 12 }}>
          <button
            onClick={() => setAutoRotate((v) => !v)}
            style={{
              background: "rgba(0,0,0,0.05)",
              border: "0.5px solid rgba(0,0,0,0.15)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 13,
              color: "#1e293b",
              cursor: "pointer",
            }}
          >
            {autoRotate ? "⏸ Pause" : "▶ Rotate"}
          </button>
        </div>
        {/* Hint */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            fontSize: 12,
            color: "rgba(0,0,0,0.35)",
          }}
        >
          Drag to rotate · Scroll to zoom
        </div>
      </div>
    </div>
  );
}
