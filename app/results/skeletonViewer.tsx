import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Point3D, Connection } from "../types";
import {
  createDifferenceArrows,
  MEDIAPIPE_CONNECTIONS,
} from "../util";

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

function buildSkeleton(pts: Point3D[], color: number, offsetX: number) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color });
  const boneMat = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity: 0.75,
  });

  const headPos = new THREE.Vector3((pts[0].x + offsetX), -pts[0].y, -pts[0].z);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), mat);
  headMesh.position.copy(headPos);
  group.add(headMesh);

  MEDIAPIPE_CONNECTIONS.forEach(({ start, end, radius }) => {
    if (start >= pts.length || end >= pts.length) return;

    const pA = new THREE.Vector3(
      (pts[start].x + offsetX),
      -pts[start].y,
      -pts[start].z,
    );
    const pB = new THREE.Vector3((pts[end].x + offsetX), -pts[end].y, -pts[end].z);
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

    [pA, pB].forEach((p) => {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 5, 5),
        boneMat,
      );
      cap.position.copy(p);
      group.add(cap);
    });
  });

  return group;
}

export default function SkeletonViewer({
  pose,
  referencePose,
}: {
  pose: Point3D[];
  referencePose: Point3D[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<Partial<SceneState>>({});
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showPose, setShowPose] = useState<boolean>(true);
  const [showReference, setShowReference] = useState<boolean>(true);
  const [showArrows, setShowArrows] = useState<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
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

    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
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

    const poseSkeleton = buildSkeleton(pose, 0x2563eb, 0);
    const refSkeleton = buildSkeleton(referencePose, 0xea580c, 0);
    if (showPose) pivot.add(poseSkeleton);
    if (showReference) pivot.add(refSkeleton);
    if (!showPose) pivot.remove(poseSkeleton);
    if (!showReference) pivot.remove(refSkeleton);

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

    const arrows = createDifferenceArrows(pose, referencePose, 0x475569);
    if (showArrows) {
      pivot.add(arrows);
    } else {
      pivot.remove(arrows);
    }

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
  }, [showPose, showReference, showArrows]);

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
        <div style={{ position: "absolute", top: 12, right: 12 }}>
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