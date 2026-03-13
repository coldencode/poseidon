import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

async function askGemini(prompt: string) {
  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = result.text;

  return { success: true, response: text ?? "" };
}

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