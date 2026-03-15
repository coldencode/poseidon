"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PoseOption = {
  id: string;
  title: string;
  image: string;
};

type CompareResponse = {
  modelPoseId: string;
  userPoseId: string;
  useWorldLandmarks: boolean;
  visibilityThreshold: number;
  summary: {
    score: number | null;
    modelPresentBoneCount: number;
    includedBoneCount: number;
    totalBoneCount: number;
    missingUserBonesPenaltyCount: number;
  };
  perBone: Array<{
    key: string;
    label: string;
    startIndex: number;
    endIndex: number;
    modelPresent: boolean;
    userPresent: boolean;
    included: boolean;
    cosineSimilarity: number | null;
    contributionPercent: number;
    modelRawVector: { x: number; y: number; z: number } | null;
    userRawVector: { x: number; y: number; z: number } | null;
    modelUnitVector: { x: number; y: number; z: number } | null;
    userUnitVector: { x: number; y: number; z: number } | null;
    modelMagnitude: number | null;
    userMagnitude: number | null;
  }>;
};

export default function ComparePage() {
  const [poses, setPoses] = useState<PoseOption[]>([]);
  const [isLoadingPoses, setIsLoadingPoses] = useState(true);
  const [modelPoseId, setModelPoseId] = useState("");
  const [userPoseId, setUserPoseId] = useState("");
  const [useWorldLandmarks, setUseWorldLandmarks] = useState(true);
  const [visibilityThreshold, setVisibilityThreshold] = useState(0.6);
  const [isComparing, setIsComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPoses = async () => {
      setIsLoadingPoses(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/compare");
        if (!response.ok) {
          throw new Error("Failed to load pose list.");
        }

        const data = (await response.json()) as { poses: PoseOption[] };
        if (!isMounted) {
          return;
        }

        setPoses(data.poses ?? []);

        if (data.poses?.length) {
          setModelPoseId((current) => current || data.poses[0].id);
          setUserPoseId((current) => current || data.poses[Math.min(1, data.poses.length - 1)].id);
        }
      } catch {
        if (!isMounted) {
          return;
        }
        setErrorMessage("Unable to load poses from /api/compare.");
      } finally {
        if (isMounted) {
          setIsLoadingPoses(false);
        }
      }
    };

    loadPoses();

    return () => {
      isMounted = false;
    };
  }, []);

  const canCompare = useMemo(
    () => Boolean(modelPoseId && userPoseId),
    [modelPoseId, userPoseId]
  );

  const selectedModelPose = useMemo(
    () => poses.find((pose) => pose.id === modelPoseId) ?? null,
    [modelPoseId, poses]
  );

  const selectedUserPose = useMemo(
    () => poses.find((pose) => pose.id === userPoseId) ?? null,
    [userPoseId, poses]
  );

  const runComparison = async () => {
    if (!canCompare) {
      return;
    }

    setIsComparing(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelPoseId,
          userPoseId,
          useWorldLandmarks,
          visibilityThreshold,
        }),
      });

      const data = (await response.json()) as CompareResponse | { error: string };
      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Comparison failed.");
      }

      setCompareResult(data as CompareResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Comparison failed.";
      setErrorMessage(message);
      setCompareResult(null);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50 text-slate-900">
      <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.24em] text-sky-600 uppercase">POSEIDON DEBUG</p>
            <h1 className="mt-1 text-xl font-semibold">Compare pose JSONs</h1>
            <p className="mt-1 text-xs text-slate-500">
              Select two poses, then inspect per-bone vector math and contribution.
            </p>
          </div>
          <Link href="/poses" className="text-xs text-slate-500 underline underline-offset-4">
            Back
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">Model pose</span>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={modelPoseId}
                onChange={(event) => setModelPoseId(event.target.value)}
                disabled={isLoadingPoses}
              >
                {poses.map((pose) => (
                  <option key={pose.id} value={pose.id}>
                    {pose.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">User pose</span>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={userPoseId}
                onChange={(event) => setUserPoseId(event.target.value)}
                disabled={isLoadingPoses}
              >
                {poses.map((pose) => (
                  <option key={pose.id} value={pose.id}>
                    {pose.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={useWorldLandmarks}
                onChange={(event) => setUseWorldLandmarks(event.target.checked)}
              />
              Use world landmarks
            </label>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              Visibility threshold
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={visibilityThreshold}
                onChange={(event) => setVisibilityThreshold(Number(event.target.value))}
                className="w-20 rounded-md border border-slate-300 px-2 py-1"
              />
            </label>

            <button
              type="button"
              onClick={runComparison}
              disabled={!canCompare || isComparing || isLoadingPoses}
              className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isComparing ? "Comparing..." : "Compare"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                Model image
              </div>
              {selectedModelPose ? (
                <div className="p-2">
                  <Image
                    src={selectedModelPose.image}
                    alt={selectedModelPose.title}
                    width={360}
                    height={560}
                    className="h-auto w-full rounded-lg border border-slate-200 object-cover"
                  />
                </div>
              ) : (
                <div className="px-3 py-5 text-xs text-slate-500">No model pose selected.</div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                User image
              </div>
              {selectedUserPose ? (
                <div className="p-2">
                  <Image
                    src={selectedUserPose.image}
                    alt={selectedUserPose.title}
                    width={360}
                    height={560}
                    className="h-auto w-full rounded-lg border border-slate-200 object-cover"
                  />
                </div>
              ) : (
                <div className="px-3 py-5 text-xs text-slate-500">No user pose selected.</div>
              )}
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {compareResult ? (
          <>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">
                  Score: {compareResult.summary.score !== null ? `${compareResult.summary.score}%` : "--"}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                  Model-visible bones: {compareResult.summary.modelPresentBoneCount}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                  Included bones: {compareResult.summary.includedBoneCount}
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                  Missing-user penalties: {compareResult.summary.missingUserBonesPenaltyCount}
                </span>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-[1200px] divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Bone</th>
                    <th className="px-3 py-2 text-left font-semibold">Idx</th>
                    <th className="px-3 py-2 text-left font-semibold">Model Present</th>
                    <th className="px-3 py-2 text-left font-semibold">User Present</th>
                    <th className="px-3 py-2 text-left font-semibold">Included</th>
                    <th className="px-3 py-2 text-left font-semibold">Cosine</th>
                    <th className="px-3 py-2 text-left font-semibold">Contribution %</th>
                    <th className="px-3 py-2 text-left font-semibold">Model Unit (x,y,z)</th>
                    <th className="px-3 py-2 text-left font-semibold">User Unit (x,y,z)</th>
                    <th className="px-3 py-2 text-left font-semibold">Model Raw (x,y,z)</th>
                    <th className="px-3 py-2 text-left font-semibold">User Raw (x,y,z)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {compareResult.perBone.map((bone) => (
                    <tr key={bone.key}>
                      <td className="px-3 py-2 font-medium">{bone.label}</td>
                      <td className="px-3 py-2">{bone.startIndex}→{bone.endIndex}</td>
                      <td className="px-3 py-2">{String(bone.modelPresent)}</td>
                      <td className="px-3 py-2">{String(bone.userPresent)}</td>
                      <td className="px-3 py-2">{String(bone.included)}</td>
                      <td className="px-3 py-2">
                        {bone.cosineSimilarity !== null ? bone.cosineSimilarity.toFixed(4) : "--"}
                      </td>
                      <td className="px-3 py-2">{bone.contributionPercent.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        {bone.modelUnitVector
                          ? `${bone.modelUnitVector.x.toFixed(3)}, ${bone.modelUnitVector.y.toFixed(3)}, ${bone.modelUnitVector.z.toFixed(3)}`
                          : "--"}
                      </td>
                      <td className="px-3 py-2">
                        {bone.userUnitVector
                          ? `${bone.userUnitVector.x.toFixed(3)}, ${bone.userUnitVector.y.toFixed(3)}, ${bone.userUnitVector.z.toFixed(3)}`
                          : "--"}
                      </td>
                      <td className="px-3 py-2">
                        {bone.modelRawVector
                          ? `${bone.modelRawVector.x.toFixed(3)}, ${bone.modelRawVector.y.toFixed(3)}, ${bone.modelRawVector.z.toFixed(3)}`
                          : "--"}
                      </td>
                      <td className="px-3 py-2">
                        {bone.userRawVector
                          ? `${bone.userRawVector.x.toFixed(3)}, ${bone.userRawVector.y.toFixed(3)}, ${bone.userRawVector.z.toFixed(3)}`
                          : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
