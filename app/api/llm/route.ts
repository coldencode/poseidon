import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY});

/**
 * 
 * @param prompt
 * @returns the output of Gemini
 */
async function askGemini(prompt: string) {
  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
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
  const { prompt } = await req.json();

  if (!prompt) {
    return NextResponse.json({
      success: false,
      error: "Prompt is required",
    });
  }

  try {
    const response = await askGemini(prompt);
    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: String(e),
    });
  }
}