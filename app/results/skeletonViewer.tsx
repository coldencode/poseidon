import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Point3D, Connection } from "../types";
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

function buildSkeleton(pts: Point3D[], color: number, offsetX: number, connections: Connection[]) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color });
  const boneMat = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity: 0.75,
  });

  pts.forEach((p) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), mat);
    mesh.position.set(p.x + offsetX, -p.y, p.z);
    group.add(mesh);
  });

  connections.forEach(({start, end}) => {
    if (start >= pts.length || end >= pts.length) return;
    const pA = new THREE.Vector3(pts[start].x + offsetX, -pts[start].y, pts[start].z);
    const pB = new THREE.Vector3(pts[end].x + offsetX, -pts[end].y, pts[end].z);
    const dir = new THREE.Vector3().subVectors(pB, pA);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, len, 6),
      boneMat,
    );
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.normalize(),
    );
    group.add(mesh);
  });

  return group;
}

export default function SkeletonViewer({
  pose,
  referencePose,
  connections,
}: {
  pose: Point3D[];
  referencePose: Point3D[];
  connections: Connection[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<Partial<SceneState>>({});
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

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
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    camera.position.set(0, 0, 3.5);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(1, 2, 3);
    scene.add(dir);

    // After scene setup, before adding pivot
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
      color: "#ffffff",
      sizeAttenuation: false,
      size: 2,
      opacity: 0.2, 
      transparent: true,
    });
    scene.add(new THREE.Points(dotGeometry, dotMaterial));

    const pivot = new THREE.Group();
    pivot.add(buildSkeleton(pose, 0x4a9eff, -0.35, connections));
    pivot.add(buildSkeleton(referencePose, 0xff7b4a, 0.35, connections));
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
  }, []);

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
            ["#4a9eff", "Pose 1"],
            ["#ff7b4a", "Pose 2"],
          ].map(([color, label]) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255,255,255,0.07)",
                border: "0.5px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 13,
                color: "#fff",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: color,
                }}
              />
              {label}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ position: "absolute", top: 12, right: 12 }}>
          <button
            onClick={() => setAutoRotate((v) => !v)}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "0.5px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 13,
              color: "#fff",
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
            color: "rgba(255,255,255,0.35)",
          }}
        >
          Drag to rotate · Scroll to zoom
        </div>
      </div>
    </div>
  );
}
