"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PoseCamera from "@/src/components/pose-camera/PoseCamera";

const PHOTO_STORAGE_KEY = "poseidon.captures";
const MAX_CAPTURE_HISTORY = 12;

export default function CameraPage() {
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.matchMedia("(max-width: 768px)").matches;
  });

  const [capturedPhotos, setCapturedPhotos] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const savedPhotos = localStorage.getItem(PHOTO_STORAGE_KEY);
    if (!savedPhotos) {
      return [];
    }

    try {
      const parsed = JSON.parse(savedPhotos);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === "string");
      }
    } catch {
      localStorage.removeItem(PHOTO_STORAGE_KEY);
    }

    return [];
  });

  const handlePhotoCaptured = useCallback((imageDataUrl: string) => {
    setCapturedPhotos((previousPhotos) => {
      const updatedPhotos = [imageDataUrl, ...previousPhotos].slice(
        0,
        MAX_CAPTURE_HISTORY
      );
      localStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(updatedPhotos));
      return updatedPhotos;
    });
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    mobileQuery.addEventListener("change", handleViewportChange);
    return () => {
      mobileQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  const frameSize = useMemo(
    () => ({
      width: isMobileViewport ? 9 : 16,
      height: isMobileViewport ? 16 : 9,
    }),
    [isMobileViewport]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 text-slate-900">
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.24em] text-sky-600 uppercase">POSEIDON CAMERA</p>
            <h1 className="mt-1 text-lg font-semibold leading-tight">Live Landmark Detection</h1>
          </div>
          <Link href="/poses" className="text-xs text-slate-500 underline underline-offset-4">
            Change
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-2">
          <PoseCamera
            frameSize={frameSize}
            showPoseStatus
            showControls
            onPhotoCaptured={handlePhotoCaptured}
          />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Client-side captures
            </p>
            <span className="text-xs text-slate-500">{capturedPhotos.length}</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {capturedPhotos.length === 0 ? (
              <div className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
                No photos yet. Tap capture to save locally in this browser.
              </div>
            ) : (
              capturedPhotos.map((photo, index) => (
                <Image
                  key={`${photo.slice(0, 24)}-${index}`}
                  src={photo}
                  alt={`Captured pose ${index + 1}`}
                  width={48}
                  height={64}
                  unoptimized
                  className="h-16 w-12 rounded-lg border border-slate-200 bg-white object-cover shadow-sm"
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
