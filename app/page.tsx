"use client"

import PoseCamera from "./src/components/pose-camera/page";

export default function Home() {
  return (
    <>
      <PoseCamera
        onSkeletonUpdate={(snapshot) => {
          console.log(snapshot.landmarks);
        }}
        callbackIntervalMs={5000}
        frameSize={{ width: 1280, height: 1280 }}
        showPoseStatus={true}
      />
    </>
  );
}
