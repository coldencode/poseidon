import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import fs from "fs";
import fetch from "node-fetch";

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

  console.log(user_skeleton);
  console.log(chosen_skeleton);
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
    Then give 3-5 instructions to transition from the current pose to the target pose.
    Start with major changes, then get smaller:
      1. Stand up
      2. Raise your right arm up
      3. Widen your chest
      4. etc.

    Instead of "Bring your left arm closer to your body", say "Bring your left arm closer to your chest", or
    "Bring your left hand closer to your shoulder, resting your elbow near your chest", etc. Provide more **relevant** detail.
    Closer / further is not that helpful.


    If there are no major changes to make, provide just the relevant notes in order of importance, and provide fewer
    to prevent overloading the user.

    Give instructions the way a professional photographer would. Be concise.

    Output format:
    Current pose: [one word]
    Target pose: [one word]
    Instructions:
    1. ...
    2. ...
    `;

  console.log(finalPrompt);
  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: finalPrompt,
    config: {
      // thinkingConfig: {thinkingBudget: 0},
      maxOutputTokens: 200,
    }
  });

  const text = result.text;

  return { success: true, response: text ?? "" };
}

/**
 * Convert text to speech using Murf TTS and save it as an MP3 file.
 *
 * @param {string} text - The text to convert to speech
 * @returns {Promise<string>} - Path to the generated MP3 file
 */
async function murfTTS(text: string) {
  const response = await fetch("https://api.murf.ai/v1/speech/stream", {
    method: "POST",
    headers: {
      "api-key": process.env.MURF_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voiceId: "Matthew",
      model: "FALCON",
      locale: "en-US",
    }),
  });

  // Read response as ArrayBuffer and convert to Buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filePath = `./public/mp3_output${Date.now()}.mp3`;

  // Save audio to file
  fs.writeFileSync(filePath, buffer);
  console.log(`Audio saved to ${filePath}`);
  return filePath;
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

  // console.log(user_skeleton, chosen_skeleton);

  if (!user_skeleton || !chosen_skeleton) {
    return NextResponse.json({
      success: false,
      error: "user skeleton and chosen skeleton is required",
    });
  }

  try {
    // Get Gemini output
    const response = await askGemini(user_skeleton, chosen_skeleton);
    console.log(response)

    // Audio location (optional - return text even if TTS fails)
    let text_to_speech: string | null = null;
    try {
      text_to_speech = await murfTTS(response.response);
      console.log('text to speech success');
    } catch {
      // TTS failed, but we still have the text response
    }

    return NextResponse.json({ ...response, text_to_speech });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: String(e),
    });
  }
}