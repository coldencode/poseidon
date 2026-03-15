"use client";
import { useEffect, useState } from "react";
import Results from "./results";
import { Pose, PoseSnapshot } from "../types";
const LAST_COMPARISON_KEY = "poseidon.lastComparison";
export default function ResultsPageClient({ target }: { target?: string }) {
  const [referencePose, setReferencePose] = useState<Pose | null>(null);
  const [comparisonPose, setComparisonPose] = useState<Pose | null>(null);
  const [referencePhoto, setReferencePhoto] = useState<string>("/pose-library/baddie_pose.png");
  const [comparisonPhoto, setComparisonPhoto] = useState<string>("/pose-library/ankle_hurt_pose.png");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    async function load() {
      try {
        const saved = typeof window !== "undefined" ? localStorage.getItem(LAST_COMPARISON_KEY) : null;
        const savedComparison = saved ? JSON.parse(saved) : null;
        let targetId = target || (savedComparison?.targetPoseId as string | undefined);
        if (!targetId && savedComparison?.targetPoseId) {
          targetId = savedComparison.targetPoseId;
        }
        const referenceUrl = targetId ? `/pose-library/${targetId}.json` : "/pose-library/baddie_pose.json";
        const referenceImageUrl = targetId ? `/pose-library/${targetId}.png` : "/pose-library/baddie_pose.png";
        const response = await fetch(referenceUrl);
        if (!response.ok) {
          throw new Error("Failed to load reference pose.");
        }
        const refJson = await response.json();
        const reference: Pose = {
          pose: targetId || "reference",
          landmarks: Array.isArray(refJson.landmarks) ? refJson.landmarks : [],
          worldLandmarks: Array.isArray(refJson.worldLandmarks) ? refJson.worldLandmarks : [],
          hasPose: true,
        };
        setReferencePose(reference);
        setReferencePhoto(referenceImageUrl);
        if (savedComparison && savedComparison.snapshot && savedComparison.photo) {
          const snapshot: PoseSnapshot = savedComparison.snapshot;
          const landmark = Array.isArray(snapshot.landmarks) ? snapshot.landmarks[0] || [] : [];
          const worldLandmark = Array.isArray(snapshot.worldLandmarks)
            ? snapshot.worldLandmarks[0] || landmark
            : landmark;
          setComparisonPose({
            pose: "user-capture",
            landmarks: [landmark],
            worldLandmarks: [worldLandmark],
            hasPose: snapshot.hasPose,
          });
          setComparisonPhoto(savedComparison.photo);
        } else {
          const fallbackResponse = await fetch("/pose-library/ankle_hurt_pose.json");
          const fallbackJson = await fallbackResponse.json();
          setComparisonPose({
            pose: "fallback",
            landmarks: Array.isArray(fallbackJson.landmarks) ? fallbackJson.landmarks : [],
            worldLandmarks: Array.isArray(fallbackJson.worldLandmarks) ? fallbackJson.worldLandmarks : [],
            hasPose: true,
          });
          setComparisonPhoto("/pose-library/ankle_hurt_pose.png");
        }
        setLoading(false);
      } catch {
        setError("Unable to load comparison data.");
        setLoading(false);
      }
    }
    load();
  }, [target]);
  if (loading) {
    return <div className="min-h-screen p-8">Loading results...</div>;
  }
  if (error || !referencePose || !comparisonPose) {
    return <div className="min-h-screen p-8">{error || "No data available."}</div>;
  }

  return (
    <Results
      pose={comparisonPose}
      referencePose={referencePose}
      photo={comparisonPhoto}
      referencePhoto={referencePhoto}
      target={target}
    />
  );
}
