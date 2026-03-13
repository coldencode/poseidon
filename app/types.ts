
// ─── Types ────────────────────────────────────────────────────────────────────

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