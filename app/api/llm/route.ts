import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import fs from "fs";
import fetch from "node-fetch";

// Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY});

/**
 * Compare a user skeleton with a target skeleton and generate a short improvement instruction.
 *
 * @param {string} user_skeleton - The user's BODY_25 skeleton (25 keypoints with x,y,confidence)
 * @param {string} chosen_skeleton - The target BODY_25 skeleton
 * @returns {Promise<{success: boolean, response: string}>} - Object containing success flag and one-sentence improvement instruction
 */
async function askGemini(user_skeleton: string, chosen_skeleton: string) {

  const finalPrompt = `
    You are an expert in human pose.

    Both skeletons are in BODY_25 format (25 keypoints with x,y,confidence).
    Compare the following two skeleton definitions.

    User Skeleton:
    ${user_skeleton}

    Target Skeleton:
    ${chosen_skeleton}

    Give ONE short sentence describing how the user skeleton can be improved to better match the target skeleton.

    Rules:
    - Only output one sentence.
    - Address the user skeleton as "you"
    - Keep it natural and friendly
    - Keep it simple and clear.
    - Do not include explanations
    `;

  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: finalPrompt,
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

  if (!user_skeleton || !chosen_skeleton) {
    return NextResponse.json({
      success: false,
      error: "user skeleton and chosen skeleton is required",
    });
  }

  try {
    // Get Gemini output
    const response = await askGemini(user_skeleton, chosen_skeleton);

    // Audio location
    const text_to_speech = await murfTTS(response.response);

    return NextResponse.json({...response, text_to_speech});

  } catch (e) {
    return NextResponse.json({
      success: false,
      error: String(e),
    });
  }
}