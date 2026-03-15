import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY});

function formatSkeletonForPrompt(rawSkeleton: string): string {
  const parsed = JSON.parse(rawSkeleton) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Skeleton must be a JSON array");
  }

  const normalized = parsed.map((row) => {
    if (!Array.isArray(row)) {
      throw new Error("Each skeleton row must be an array");
    }

    return row.map((value) => {
      const numberValue =
        typeof value === "number" ? value : Number(String(value));

      if (!Number.isFinite(numberValue)) {
        throw new Error("Skeleton values must be numeric");
      }

      return numberValue;
    });
  });

  return JSON.stringify(normalized);
}

/**
 * Compare a user skeleton with a target skeleton and generate a short improvement instruction.
 *
 * @param {string} user_skeleton - The user's BODY_25 skeleton (25 keypoints with x,y,confidence)
 * @param {string} chosen_skeleton - The target BODY_25 skeleton
 * @returns {Promise<{success: boolean, response: string}>} - Object containing success flag and one-sentence improvement instruction
 */
async function askGemini(user_skeleton: string, chosen_skeleton: string) {
  const userSkeleton = formatSkeletonForPrompt(user_skeleton);
  const chosenSkeleton = formatSkeletonForPrompt(chosen_skeleton);

  const finalPrompt = `
    You are an expert in human pose.

    Both skeletons are in a mediapipe-inspired 3D landmarks format (keypoints with x,y,z,visibility).
    nose,
    
    Landmarks order: left_wrist, right_wrist, left_hip, right_hip, left_knee, right_knee, left_ankle, right_ankle, left_thumb, right_thumb, left_elbow, right_elbow, left_shoulder, right_shoulder, left_heel, right_heel, left_foot_index, right_foot_index

    Compare the following two skeleton definitions.

    Your pose:
    ${userSkeleton}

    Target pose:
    ${chosenSkeleton}

    First, identify the overall pose categories of the current and target pose (e.g. standing, sitting, crouching).
    Then give the single most important instruction to transition from the current pose to the target pose.
    Focus on the most significant difference first, and provide concise, relevant detail as if you were a professional photographer giving quick direction.

    Example commands:
    - Stand up straight!
    - Raise your right arm up a bit.
    - Widen your chest and bring your left arm closer to your body.
    - Your left knee is bent, try straightening it and pointing it forward.
    - Tilt your head slightly to the right and relax your shoulders.

    If there are no major changes to make, provide positive feedback.

    Output format:
    {
      cur_pose_category: string;
      target_pose_category: string;
      necessary_improvements: string[];
      instruction: string;
    }
    `;

  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: finalPrompt,
    config: {
      // thinkingConfig: {thinkingBudget: 0},
      maxOutputTokens: 200,
    }
  });

  const rawText = result.text?.trim() ?? "";
  const cleanedText = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const full_response = JSON.parse(cleanedText) as {
    cur_pose_category: string;
    target_pose_category: string;
    necessary_improvements: string[];
    instruction: string;
  };

  const text = full_response.instruction;

  return { success: true, response: text ?? "" };
}

/**
 * POST API endpoint to compare BODY_25 skeletons and generate TTS audio.
 *
 * Expects JSON body:
 * {
 *   "user_skeleton": "[[x, y, confidence], ...]",
 *   "chosen_skeleton": "[[x, y, confidence], ...]"
 * }
 *
 * Returns JSON:
 * {
 *   "success": true,
 *   "response": "Instruction text",
 *   "text_to_speech": "./public/mp3_output123456789.mp3"
 * }
 *
 * @param {Request} req - The incoming HTTP request
 * @returns {Promise<NextResponse>} - JSON response with Gemini text and audio file location
 */
export async function POST(req: Request) {
  const { user_skeleton, chosen_skeleton } = await req.json();

  if (!user_skeleton || !chosen_skeleton) {
    return NextResponse.json(
      {
        success: false,
        error: "user skeleton and chosen skeleton is required",
      },
      { status: 400 }
    );
  }

  try {
    // Get Gemini output
    const response = await askGemini(user_skeleton, chosen_skeleton);

    // Audio location (optional - return text even if TTS fails)
    const text_to_speech: string | null = null;
    // try {
    //   text_to_speech = await murfTTS(response.response);
    //   console.log('text to speech success');
    // } catch {
    //   // TTS failed, but we still have the text response
    // }

    return NextResponse.json({ ...response, text_to_speech });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: String(e),
      },
      { status: 500 }
    );
  }
}