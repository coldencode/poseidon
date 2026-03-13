"use client";

import { useState, useRef, useCallback } from "react";
import styles from "./dashboard.module.css";
import clsx from "clsx";

// ─── Constants ────────────────────────────────────────────────────────────────

const POSES: Pose[] = [
  {
    id: 1,
    name: "Warrior I",
    emoji: "🧘",
    difficulty: "Medium",
    calories: 120,
    muscle: "Legs",
  },
  {
    id: 2,
    name: "Downward Dog",
    emoji: "🐕",
    difficulty: "Easy",
    calories: 80,
    muscle: "Full Body",
  },
  {
    id: 3,
    name: "Plank",
    emoji: "💪",
    difficulty: "Hard",
    calories: 200,
    muscle: "Core",
  },
  {
    id: 4,
    name: "Tree Pose",
    emoji: "🌳",
    difficulty: "Medium",
    calories: 90,
    muscle: "Balance",
  },
  {
    id: 5,
    name: "Chair Pose",
    emoji: "🪑",
    difficulty: "Medium",
    calories: 150,
    muscle: "Quads",
  },
  {
    id: 6,
    name: "Cobra",
    emoji: "🐍",
    difficulty: "Easy",
    calories: 70,
    muscle: "Back",
  },
];

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  Easy: "#00F5A0",
  Medium: "#FFD93D",
  Hard: "#FF6B6B",
};

const STATS: Stat[] = [
  { label: "Sessions", value: "48", icon: "🔥", color: "#FF6B6B" },
  { label: "Accuracy", value: "94%", icon: "🎯", color: "#00F5A0" },
  { label: "Streak", value: "12d", icon: "⚡", color: "#FFD93D" },
  { label: "Calories", value: "3.2k", icon: "💥", color: "#FF9FF3" },
];

// ─── DropZone Component ───────────────────────────────────────────────────────

function DropZone({ label, icon, onDrop, file, color }: DropZoneProps) {
  const [dragging, setDragging] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onDrop(f);
    },
    [onDrop],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onDrop(e.target.files[0]);
  };

  return (
    <div
      className={styles.dropZone}
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? color : "rgba(255,255,255,0.2)"}`,
        background: dragging ? `${color}15` : "rgba(255,255,255,0.04)",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleInputChange}
      />

      {file ? (
        <>
          <img
            src={URL.createObjectURL(file)}
            alt="preview"
            className={styles.dropZonePreviewImg}
          />
          <div className={styles.dropZonePreviewInfo}>
            <div style={{ fontSize: "28px" }}>✅</div>
            <div className={styles.dropZoneFileName}>
              {file.name.slice(0, 20)}…
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className={styles.dropZoneIconWrap}
            style={{ background: `${color}22` }}
          >
            {icon}
          </div>
          <div style={{ textAlign: "center" }}>
            <div className={styles.dropZoneLabel}>{label}</div>
            <div className={styles.dropZoneHint}>drag & drop or click</div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dashboard Component ──────────────────────────────────────────────────────

export default function PoseDashboard() {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [selectedPose, setSelectedPose] = useState<Pose | null>(null);
  const [picFile, setPicFile] = useState<File | null>(null);
  const [poseFile, setPoseFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [score, setScore] = useState<number | null>(null);

  const handleAnalyze = () => {
    if (!picFile && !cameraActive) return;
    setAnalyzing(true);
    setTimeout(() => {
      setScore(Math.floor(Math.random() * 20) + 80);
      setAnalyzing(false);
    }, 2000);
  };

  const handlePoseClick = (pose: Pose) => {
    setSelectedPose(pose.id === selectedPose?.id ? null : pose);
  };

  const handleCameraBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setCameraActive(true);
  };

  const scoreFeedback =
    score === null
      ? ""
      : score >= 90
        ? "🔥 Excellent form!"
        : score >= 80
          ? "👍 Good job, keep it up!"
          : "💪 Keep practicing!";

  return (
    <div className={styles.dashboardBackground}>
      <div className={clsx(styles.dashboard)}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.logo}>POSEIDEN</div>
            <div className={styles.headerSubtitle}>
              AI-powered movement intelligence
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.modelReadyBadge}>
              <div
                className={styles.liveDot}
                style={{ background: "#00F5A0" }}
              />
              Model Ready
            </div>
            <div className={styles.avatarCircle}>J</div>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          {STATS.map((s) => (
            <div className={styles.statCard} key={s.label}>
              <div
                className={styles.statIcon}
                style={{ background: `${s.color}18` }}
              >
                {s.icon}
              </div>
              <div>
                <div className={styles.statValue} style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Panel */}
        <div className={styles.mainPanel}>
          {/* Camera */}
          <div>
            <div className={styles.sectionLabel}>
              {cameraActive && <div className={styles.liveDot} />}
              📷 Live Camera Feed
            </div>
            <div
              className={`${styles.cameraView} ${cameraActive ? styles.cameraViewActive : ""}`}
              onClick={() => setCameraActive(!cameraActive)}
            >
              {cameraActive ? (
                <>
                  <div className={styles.cameraGrid} />
                  <div style={{ fontSize: "64px" }}>🏃</div>
                  <div className={styles.detectingText}>DETECTING POSE...</div>
                  <div className={styles.liveBadge}>
                    <div
                      className={styles.liveDot}
                      style={{
                        background: "#fff",
                        width: "6px",
                        height: "6px",
                      }}
                    />
                    LIVE
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "48px", opacity: 0.4 }}>📷</div>
                  <div className={styles.cameraOffHint}>
                    Click to activate camera
                  </div>
                  <button
                    className={styles.cameraBtn}
                    onClick={handleCameraBtn}
                  >
                    Start Camera
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Upload */}
          <div>
            <div className={styles.sectionLabel}>⬆️ Upload</div>
            <div className={styles.uploadRow}>
              <DropZone
                label="Upload Picture"
                icon="🖼️"
                color="#FF9FF3"
                onDrop={setPicFile}
                file={picFile}
              />
              <DropZone
                label="Upload Your Pose"
                icon="🧘"
                color="#FFD93D"
                onDrop={setPoseFile}
                file={poseFile}
              />
            </div>
          </div>
        </div>

        {/* Library Panel */}
        <div className={styles.libraryPanel}>
          <div className={styles.libraryTitle}>📚 Pose Library</div>

          {selectedPose && (
            <div className={styles.selectedPosePreview}>
              <div style={{ fontSize: "32px", textAlign: "center" }}>
                {selectedPose.emoji}
              </div>
              <div className={styles.selectedPoseName}>{selectedPose.name}</div>
              <div className={styles.selectedPoseMeta}>
                <span>🏋️ {selectedPose.muscle}</span>
                <span>🔥 {selectedPose.calories} cal</span>
              </div>
            </div>
          )}

          <div className={styles.poseList}>
            {POSES.map((pose) => (
              <div
                key={pose.id}
                className={`${styles.poseCard} ${selectedPose?.id === pose.id ? styles.poseCardSelected : ""}`}
                onClick={() => handlePoseClick(pose)}
              >
                <div className={styles.poseEmoji}>{pose.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.poseName}>{pose.name}</div>
                  <div className={styles.poseMeta}>
                    <span
                      className={styles.difficultyBadge}
                      style={{
                        color: DIFFICULTY_COLORS[pose.difficulty],
                        background: `${DIFFICULTY_COLORS[pose.difficulty]}18`,
                        border: `1px solid ${DIFFICULTY_COLORS[pose.difficulty]}40`,
                      }}
                    >
                      {pose.difficulty}
                    </span>
                    <span className={styles.poseMuscle}>{pose.muscle}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
