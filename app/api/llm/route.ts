import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY});

/**
 * Compare user skeleton and chosen
 * @param user_skeleton
 * @returns the output of Gemini that give instruction to match the target
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
    - Maximum 20 words
    `;

  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: finalPrompt,
  });

  const text = result.text;

  return { success: true, response: text ?? "" };
}

/**
 * 
 * @param req 
 * @returns a json containing the the output of Gemini
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
    const response = await askGemini(user_skeleton, chosen_skeleton);
    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: String(e),
    });
  }
}