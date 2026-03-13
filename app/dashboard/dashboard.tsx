"use client";

import { useState, useRef, useCallback } from "react";
import {
  Box,
  Chip,
  IconButton,
  Typography,
  Paper,
  Tooltip,
  Fade,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import styles from "./dashboard.module.css";
import clsx from "clsx";

// ─── Types ─────────────────────────────────────────────────────────────────

type Difficulty = "Easy" | "Medium" | "Hard";

interface Pose {
  id: number;
  name: string;
  emoji: string;
  difficulty: Difficulty;
  calories: number;
  muscle: string;
}

interface Stat {
  label: string;
  value: string;
  icon: string;
  color: string;
}

interface DropZoneProps {
  label: string;
  icon: string;
  onDrop: (file: File) => void;
  file: File | null;
  color: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const POSES: Pose[] = [
  { id: 1, name: "Warrior I",    emoji: "🧘", difficulty: "Medium", calories: 120, muscle: "Legs"      },
  { id: 2, name: "Downward Dog", emoji: "🐕", difficulty: "Easy",   calories: 80,  muscle: "Full Body" },
  { id: 3, name: "Plank",        emoji: "💪", difficulty: "Hard",   calories: 200, muscle: "Core"      },
  { id: 4, name: "Tree Pose",    emoji: "🌳", difficulty: "Medium", calories: 90,  muscle: "Balance"   },
  { id: 5, name: "Chair Pose",   emoji: "🪑", difficulty: "Medium", calories: 150, muscle: "Quads"     },
  { id: 6, name: "Cobra",        emoji: "🐍", difficulty: "Easy",   calories: 70,  muscle: "Back"      },
];

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  Easy:   "#00F5A0",
  Medium: "#FFD93D",
  Hard:   "#FF6B6B",
};

const STATS: Stat[] = [
  { label: "Sessions", value: "48",   icon: "🔥", color: "#FF6B6B" },
  { label: "Accuracy", value: "94%",  icon: "🎯", color: "#00F5A0" },
  { label: "Streak",   value: "12d",  icon: "⚡", color: "#FFD93D" },
  { label: "Calories", value: "3.2k", icon: "💥", color: "#FF9FF3" },
];

// ─── Styled Components (for MUI overrides only) ────────────────────────────

const GlassCard = styled(Paper)(() => ({
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 28,
  backdropFilter: "blur(8px)",
}));

const PoseCardItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== "selected",
})<{ selected?: boolean }>(({ selected }) => ({
  background: selected ? "rgba(255,107,107,0.1)" : "rgba(255,255,255,0.04)",
  border: `1px solid ${selected ? "rgba(255,107,107,0.5)" : "rgba(255,255,255,0.07)"}`,
  borderRadius: 16,
  padding: "14px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  transition: "all 0.18s",
  "&:hover": {
    background: selected ? "rgba(255,107,107,0.15)" : "rgba(255,255,255,0.08)",
    transform: "translateX(4px)",
  },
}));

const CameraBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(({ active }) => ({
  borderRadius: 20,
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${active ? "#FF6B6B" : "rgba(255,255,255,0.1)"}`,
  boxShadow: active ? "0 0 30px #FF6B6B22" : "none",
  height: 300,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column" as const,
  gap: 16,
  position: "relative" as const,
  overflow: "hidden",
  cursor: "pointer",
  transition: "border-color 0.2s",
  "&:hover": {
    borderColor: active ? "#FF6B6B" : "rgba(255,107,107,0.5)",
  },
}));

// ─── DropZone ──────────────────────────────────────────────────────────────

function DropZone({ label, icon, onDrop, file, color }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onDrop(f);
    },
    [onDrop]
  );

  return (
    <Box
      flex={1}
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="relative flex flex-col items-center justify-center gap-3 cursor-pointer rounded-2xl min-h-[160px] sm:min-h-[180px] overflow-hidden transition-all duration-200"
      sx={{
        border: `2px dashed ${dragging ? color : "rgba(255,255,255,0.2)"}`,
        background: dragging ? `${color}15` : "rgba(255,255,255,0.04)",
        borderRadius: "20px",
        p: { xs: "20px 12px", sm: "32px 16px" },
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onDrop(e.target.files[0])}
      />

      {file ? (
        <>
          <img
            src={URL.createObjectURL(file)}
            alt="preview"
            className="absolute inset-0 w-full h-full object-cover rounded-[18px] opacity-60"
          />
          <Box className="relative z-10 text-center">
            <div className="text-3xl">✅</div>
            <p className={clsx(styles.syne, "text-white font-bold text-sm mt-1")}>
              {file.name.slice(0, 20)}…
            </p>
          </Box>
        </>
      ) : (
        <>
          <Box
            className="flex items-center justify-center w-16 h-16 rounded-full text-4xl"
            sx={{ background: `${color}22` }}
          >
            {icon}
          </Box>
          <Box className="text-center">
            <p className={clsx(styles.syne, "text-white font-extrabold text-sm")}>{label}</p>
            <p className={clsx(styles.dmSans, "text-white/40 text-xs mt-1")}>drag & drop or click</p>
          </Box>
        </>
      )}
    </Box>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export default function PoseDashboard() {
  const [cameraActive, setCameraActive] = useState(false);
  const [selectedPose, setSelectedPose] = useState<Pose | null>(null);
  const [picFile,  setPicFile]  = useState<File | null>(null);
  const [poseFile, setPoseFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const handleAnalyze = () => {
    if (!picFile && !cameraActive) return;
    setAnalyzing(true);
    setTimeout(() => {
      setScore(Math.floor(Math.random() * 20) + 80);
      setAnalyzing(false);
    }, 2000);
  };

  const scoreFeedback =
    score === null ? "" :
    score >= 90 ? "🔥 Excellent form!" :
    score >= 80 ? "👍 Good job, keep it up!" :
    "💪 Keep practicing!";

  return (
    <Box
      sx={{
        position: "relative",
        zIndex: 10,
        display: "grid",
        width: "100%",
        gap: "20px",
        padding: { xs: "16px", sm: "24px", lg: "32px" },
        maxWidth: "1280px",
        mx: "auto",
        color: "white",
        gridTemplateColumns: { xs: "1fr", lg: "1fr 280px" },
        gridTemplateRows: "auto auto 1fr",
        fontFamily: "'DM Sans', sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* ── Header ── */}
      <Box sx={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <Box>
          <div className={styles.logo}>POSEIDEN</div>
          <p className={clsx(styles.dmSans, "text-white/40 text-xs sm:text-sm mt-0.5")}>
            AI-powered movement intelligence
          </p>
        </Box>

        <Box className="flex items-center gap-3">
          <Chip
            label={
              <span className="flex items-center gap-2">
                <span className={clsx(styles.pulse, "inline-block w-2 h-2 rounded-full bg-[#00F5A0]")} />
                Model Ready
              </span>
            }
            className={styles.syne}
            sx={{
              background: "rgba(0,245,160,0.12)",
              border: "1px solid rgba(0,245,160,0.3)",
              color: "#00F5A0",
              fontWeight: 700,
              fontFamily: "'Syne', sans-serif",
              fontSize: 13,
            }}
          />
          <Box
            className={clsx(styles.avatarCircle, "w-10 h-10 rounded-full flex items-center justify-center text-base")}
          >
            J
          </Box>
        </Box>
      </Box>

      {/* ── Stats Row ── */}
      <Box
        sx={{ gridColumn: "1 / -1", display: "grid", gap: "16px", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}
      >
        {STATS.map((s) => (
          <Box
            key={s.label}
            className="flex items-center gap-4 p-5 rounded-2xl transition-transform duration-200 hover:-translate-y-0.5"
            sx={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Box
              className="flex items-center justify-center w-12 h-12 rounded-2xl text-2xl shrink-0"
              sx={{ background: `${s.color}18` }}
            >
              {s.icon}
            </Box>
            <Box>
              <p className={clsx(styles.syne, "font-extrabold text-2xl sm:text-3xl leading-none")}
                 style={{ color: s.color }}>
                {s.value}
              </p>
              <p className={clsx(styles.dmSans, "text-[11px] text-white/45 mt-1 uppercase tracking-wider font-medium")}>
                {s.label}
              </p>
            </Box>
          </Box>
        ))}
      </Box>

      {/* ── Main Panel ── */}
      <GlassCard className="flex flex-col gap-5 p-5 sm:p-7" elevation={0}>

        {/* Camera */}
        <Box>
          <Box className="flex items-center gap-2 mb-3">
            {cameraActive && (
              <span className={clsx(styles.pulse, "inline-block w-2 h-2 rounded-full bg-[#FF6B6B]")} />
            )}
            <p className={clsx(styles.syne, "font-extrabold text-base text-white")}>
              📷 Live Camera Feed
            </p>
          </Box>

          <CameraBox active={cameraActive} onClick={() => setCameraActive((v) => !v)}>
            {cameraActive ? (
              <>
                <div className={styles.cameraGrid} />
                <div className="text-6xl">🏃</div>
                <p className={clsx(styles.syne, "text-[#FF6B6B] font-extrabold text-sm")}>
                  DETECTING POSE...
                </p>
                <Chip
                  label={
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-white" />
                      LIVE
                    </span>
                  }
                  size="small"
                  sx={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    background: "#FF6B6B",
                    color: "#fff",
                    fontFamily: "'Syne', sans-serif",
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                />
              </>
            ) : (
              <>
                <div className="text-5xl opacity-40">📷</div>
                <p className={clsx(styles.dmSans, "text-white/40 text-sm")}>Click to activate camera</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setCameraActive(true); }}
                  className={clsx(
                    styles.syne,
                    "border-none text-white font-extrabold text-sm px-8 py-3.5 rounded-full cursor-pointer tracking-wide",
                    "transition-transform duration-200 hover:scale-[1.04] hover:opacity-90"
                  )}
                  style={{ background: "linear-gradient(135deg, #FF6B6B, #FF9FF3)" }}
                >
                  Start Camera
                </button>
              </>
            )}
          </CameraBox>
        </Box>

        {/* Upload */}
        <Box>
          <p className={clsx(styles.syne, "font-extrabold text-base text-white mb-3")}>⬆️ Upload</p>
          <Box className="flex flex-col sm:flex-row gap-4">
            <DropZone label="Upload Picture"   icon="🖼️" color="#FF9FF3" onDrop={setPicFile}  file={picFile}  />
            <DropZone label="Upload Your Pose" icon="🧘" color="#FFD93D" onDrop={setPoseFile} file={poseFile} />
          </Box>
        </Box>



        {/* Score */}
        {score !== null && (
          <Fade in>
            <Box
              className={clsx(styles.fadeIn, "rounded-2xl p-5 text-center")}
              sx={{
                background: "rgba(0,245,160,0.12)",
                border: "1px solid rgba(0,245,160,0.3)",
              }}
            >
              <p className={clsx(styles.syne, "text-white/50 text-xs font-bold uppercase tracking-widest mb-2")}>
                Pose Score
              </p>
              <p className={clsx(styles.syne, "font-black text-[56px] text-[#00F5A0] leading-none")}>{score}</p>
              <p className={clsx(styles.dmSans, "text-white/50 text-sm mt-2")}>{scoreFeedback}</p>
            </Box>
          </Fade>
        )}
      </GlassCard>

      {/* ── Library Panel ── */}
      <GlassCard
        className="flex flex-col gap-4 p-5 sm:p-6 overflow-hidden"
        elevation={0}
        sx={{ maxHeight: { lg: "100%" } }}
      >
        <p className={clsx(styles.syne, "font-extrabold text-lg text-white")}>📚 Pose Library</p>

        {selectedPose && (
          <Box
            className="rounded-2xl p-3.5 mb-1"
            sx={{
              background: "rgba(255,107,107,0.1)",
              border: "1px solid rgba(255,107,107,0.3)",
            }}
          >
            <div className="text-3xl text-center">{selectedPose.emoji}</div>
            <p className={clsx(styles.syne, "font-extrabold text-center text-base my-2")}>{selectedPose.name}</p>
            <Box className="flex justify-between">
              <span className={clsx(styles.dmSans, "text-xs text-white/50")}>🏋️ {selectedPose.muscle}</span>
              <span className={clsx(styles.dmSans, "text-xs text-white/50")}>🔥 {selectedPose.calories} cal</span>
            </Box>
          </Box>
        )}

        <Box className="flex flex-col gap-2 overflow-y-auto flex-1">
          {POSES.map((pose) => (
            <PoseCardItem
              key={pose.id}
              selected={selectedPose?.id === pose.id}
              onClick={() => setSelectedPose(pose.id === selectedPose?.id ? null : pose)}
            >
              <Box
                className="flex items-center justify-center w-11 h-11 text-2xl shrink-0 rounded-xl"
                sx={{ background: "rgba(255,255,255,0.06)" }}
              >
                {pose.emoji}
              </Box>
              <Box flex={1} minWidth={0}>
                <p className={clsx(styles.syne, "font-bold text-sm text-white")}>{pose.name}</p>
                <Box className="flex items-center gap-2 mt-1">
                  <span
                    className={clsx(styles.syne, "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full")}
                    style={{
                      color:       DIFFICULTY_COLORS[pose.difficulty],
                      background:  `${DIFFICULTY_COLORS[pose.difficulty]}18`,
                      border:      `1px solid ${DIFFICULTY_COLORS[pose.difficulty]}40`,
                    }}
                  >
                    {pose.difficulty}
                  </span>
                  <span className={clsx(styles.dmSans, "text-[11px] text-white/30")}>{pose.muscle}</span>
                </Box>
              </Box>
            </PoseCardItem>
          ))}
        </Box>
      </GlassCard>
    </Box>
  );
}