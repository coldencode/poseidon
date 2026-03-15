/**
 * Pose detection utilities using MediaPipe.
 * Runs in the browser only (MediaPipe requires WebAssembly).
 *
 * Primary entry point: `detectPoseInFrame` — accepts any image-like source and
 * returns the full 33 NormalizedLandmark objects for the first detected person.
 *
 * The legacy `imageToPose` / `imageToPoseJson` exports are preserved for
 * backward-compatibility.
 */
import {
  PoseLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
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
 * Full result from a single-frame pose detection.
 *
 * `landmarks` and `worldLandmarks` each contain exactly 33 points (MediaPipe
 * Pose Landmarker) for the first detected person, or an empty array when no
 * person is visible.
 *
 * - `landmarks`      — normalised screen-space coordinates (x/y in [0,1], z relative)
 * - `worldLandmarks` — metric world-space coordinates (x/y/z in metres)
 */
export type PoseDetectionResult = {
  /** All 33 normalised landmarks for the first detected person, or [] when none. */
  landmarks: NormalizedLandmark[];
  /** All 33 world-space landmarks for the first detected person, or [] when none. */
  worldLandmarks: NormalizedLandmark[];
  /** True when at least one person was detected. */
  hasPose: boolean;
};

/** Any source that can be passed to `detectPoseInFrame`. */
export type PoseFrameSource =
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLCanvasElement
  | string; // data URL, absolute URL, or path (e.g. "/pose-library/pose1.png")

/**
 * Detects pose landmarks in any image-like source.
 *
 * Accepts:
 *  - `HTMLImageElement`  — already-loaded img element
 *  - `HTMLVideoElement`  — current video frame is snapshotted
 *  - `HTMLCanvasElement` — canvas pixels used directly
 *  - `string`            — URL / path / data URL (loaded into an img)
 *
 * Returns the full 33 NormalizedLandmark points for the first detected person,
 * or empty arrays when no person is visible.
 */
export async function detectPoseInFrame(
  source: PoseFrameSource
): Promise<PoseDetectionResult> {
  const poseLandmarker = await getPoseLandmarker();

  let imgEl: HTMLImageElement | HTMLCanvasElement;

  if (typeof source === "string") {
    imgEl = await loadImage(source);
  } else if (source instanceof HTMLVideoElement) {
    imgEl = videoToCanvas(source);
  } else {
    imgEl = source;
  }

  const result = poseLandmarker.detect(imgEl);

  return {
    landmarks: result.landmarks?.[0] ?? [],
    worldLandmarks: result.worldLandmarks?.[0] ?? [],
    hasPose: (result.landmarks?.length ?? 0) > 0,
  };
}

/** Snapshot a video element's current frame onto an off-screen canvas. */
function videoToCanvas(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || video.width;
  canvas.height = video.videoHeight || video.height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

/**
 * Detects pose landmarks in any image-like source and returns a JSON string.
 * Convenience wrapper around `detectPoseInFrame`.
 */
export async function detectPoseInFrameJson(
  source: PoseFrameSource
): Promise<string> {
  const result = await detectPoseInFrame(source);
  return JSON.stringify(result, null, 2);
}

// ---------------------------------------------------------------------------
// Legacy API — preserved for backward-compatibility
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `detectPoseInFrame` instead.
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

/** @deprecated Use `detectPoseInFrameJson` instead. */
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
