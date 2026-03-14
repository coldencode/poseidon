import { NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";

/** POST: Store a body pose JSON */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const collection = await getCollection();
    const doc = {
      ...body,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(doc);

    return NextResponse.json({
      success: true,
      id: result.insertedId.toString(),
    });
  } catch (e) {
    console.error("POST /api/poses:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}

/** GET: List poses (optional query: ?limit=20) */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

    const collection = await getCollection();
    const poses = await collection
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      poses: poses.map((p) => ({
        ...p,
        _id: p._id.toString(),
      })),
    });
  } catch (e) {
    console.error("GET /api/poses:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
