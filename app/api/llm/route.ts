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

    Both skeletons are in mediapipe 33 3D landmarks format (33 keypoints with x,y,z,visibility).
    | Index | Name                 | Description / Body Part     | Notes                                |
| ----- | -------------------- | --------------------------- | ------------------------------------ |
| 0     | **nose**             | Tip of the nose             | Central reference point for the head |
| 1     | **left_eye_inner**   | Inner corner of left eye    | Near nose bridge                     |
| 2     | **left_eye**         | Center of left eye          | Main eye point                       |
| 3     | **left_eye_outer**   | Outer corner of left eye    |                                      |
| 4     | **right_eye_inner**  | Inner corner of right eye   | Near nose bridge                     |
| 5     | **right_eye**        | Center of right eye         |                                      |
| 6     | **right_eye_outer**  | Outer corner of right eye   |                                      |
| 7     | **left_ear**         | Center of left ear          | Side of head                         |
| 8     | **right_ear**        | Center of right ear         | Side of head                         |
| 9     | **mouth_left**       | Left corner of mouth        | Lip edge                             |
| 10    | **mouth_right**      | Right corner of mouth       | Lip edge                             |
| 11    | **left_shoulder**    | Top of left shoulder        | Main joint connecting arm            |
| 12    | **right_shoulder**   | Top of right shoulder       |                                      |
| 13    | **left_elbow**       | Middle of left arm          | Between shoulder and wrist           |
| 14    | **right_elbow**      | Middle of right arm         |                                      |
| 15    | **left_wrist**       | End of left arm             | Furthest from torso                  |
| 16    | **right_wrist**      | End of right arm            |                                      |
| 17    | **left_pinky**       | Tip of left pinky finger    | Hand landmark                        |
| 18    | **right_pinky**      | Tip of right pinky finger   |                                      |
| 19    | **left_index**       | Tip of left index finger    |                                      |
| 20    | **right_index**      | Tip of right index finger   |                                      |
| 21    | **left_thumb**       | Tip of left thumb           |                                      |
| 22    | **right_thumb**      | Tip of right thumb          |                                      |
| 23    | **left_hip**         | Top of left leg / pelvis    | Main joint connecting torso and leg  |
| 24    | **right_hip**        | Top of right leg / pelvis   |                                      |
| 25    | **left_knee**        | Middle of left leg          | Between hip and ankle                |
| 26    | **right_knee**       | Middle of right leg         |                                      |
| 27    | **left_ankle**       | Bottom of left leg          | Furthest from torso                  |
| 28    | **right_ankle**      | Bottom of right leg         |                                      |
| 29    | **left_heel**        | Back of left foot           | Behind ankle                         |
| 30    | **right_heel**       | Back of right foot          |                                      |
| 31    | **left_foot_index**  | Tip of left foot / big toe  | Front of foot                        |
| 32    | **right_foot_index** | Tip of right foot / big toe |                                      |

    Compare the following two skeleton definitions.

    Your pose:
    ${user_skeleton}

    Target pose:
    ${chosen_skeleton}

    Give a set of instructions to improve the user pose to match the target pose.
    `;

  console.log(finalPrompt);
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

    // Audio location (optional - return text even if TTS fails)
    let text_to_speech: string | null = null;
    try {
      text_to_speech = await murfTTS(response.response);
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