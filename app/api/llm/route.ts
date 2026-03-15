import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

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

async function askGemini(user_skeleton: string, chosen_skeleton: string) {
  const userSkeleton = formatSkeletonForPrompt(user_skeleton);
  const chosenSkeleton = formatSkeletonForPrompt(chosen_skeleton);

  const finalPrompt = `
You are an expert in human pose analysis.

Both skeletons are arrays of keypoints in [x, y, z, visibility] format.

Landmark order:
nose, left_wrist, right_wrist, left_hip, right_hip, left_knee, right_knee,
left_ankle, right_ankle, left_thumb, right_thumb, left_elbow, right_elbow,
left_shoulder, right_shoulder, left_heel, right_heel, left_foot_index, right_foot_index

Your pose:
${userSkeleton}

Target pose:
${chosenSkeleton}

First, identify the overall pose category of each (e.g. standing, sitting, crouching).
Then give the single most important instruction to transition from the current pose to the target pose.
Focus on the most significant difference. Be concise, like a photographer giving quick direction.

Example instructions:
- Stand up straight!
- Raise your right arm up a bit.
- Widen your chest and bring your left arm closer to your body.
- Your left knee is bent, try straightening it and pointing it forward.
- Tilt your head slightly to the right and relax your shoulders.

If there are no major changes to make, provide positive feedback.

Respond with this exact JSON structure:
{
  "cur_pose_category": "string",
  "target_pose_category": "string",
  "necessary_improvements": ["string"],
  "instruction": "string"
}
`;

  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: finalPrompt,
    config: {
      responseMimeType: "application/json",
      // maxOutputTokens: 200,
      thinkingConfig: { thinkingBudget: 0}
    },
  });

  const rawText = result.text?.trim() ?? "";

  const full_response = JSON.parse(rawText) as {
    cur_pose_category: string;
    target_pose_category: string;
    necessary_improvements: string[];
    instruction: string;
  };

  return { success: true, response: full_response.instruction ?? "" };
}

export async function POST(req: Request) {
  const { user_skeleton, chosen_skeleton } = await req.json();

  if (!user_skeleton || !chosen_skeleton) {
    return NextResponse.json(
      { success: false, error: "user_skeleton and chosen_skeleton are required" },
      { status: 400 }
    );
  }

  try {
    const response = await askGemini(user_skeleton, chosen_skeleton);
    return NextResponse.json({ ...response, text_to_speech: null });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}