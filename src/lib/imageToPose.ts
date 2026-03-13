/**
 * Converts an image to pose landmarks JSON using MediaPipe.
 * Runs in the browser only (MediaPipe requires WebAssembly).
 */
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

const MEDIAPIPE_WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let poseLandmarkerInstance: PoseLandmarker | null = null;

async function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (poseLandmarkerInstance) return poseLandmarkerInstance;

  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_URL);
  poseLandmarkerInstance = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: POSE_MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "IMAGE",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return poseLandmarkerInstance;
}

export type ImagePoseResult = {
  landmarks: PoseLandmarkerResult["landmarks"];
  worldLandmarks: PoseLandmarkerResult["worldLandmarks"];
  hasPose: boolean;
};

/**
 * Detects pose landmarks in an image and returns them as JSON-serializable data.
 * @param image - HTMLImageElement, image URL, or path (e.g. "/pose-library/pose1.png")
 * @returns Object with landmarks, worldLandmarks, and hasPose
 */
export async function imageToPose(
  image: HTMLImageElement | string
): Promise<ImagePoseResult> {
  let imgEl: HTMLImageElement;

  if (typeof image === "string") {
    imgEl = await loadImage(image);
  } else {
    imgEl = image;
  }

  const poseLandmarker = await getPoseLandmarker();
  const result = poseLandmarker.detect(imgEl);

  const landmarks = result.landmarks ?? [];
  const worldLandmarks = result.worldLandmarks ?? [];
  const hasPose = landmarks.length > 0;

  return {
    landmarks,
    worldLandmarks,
    hasPose,
  };
}

/**
 * Same as imageToPose but returns a JSON string.
 */
export async function imageToPoseJson(
  image: HTMLImageElement | string
): Promise<string> {
  const result = await imageToPose(image);
  return JSON.stringify(result, null, 2);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src =
      src.startsWith("http") || src.startsWith("/") || src.startsWith("data:")
        ? src
        : `/${src}`;
  });
}
