import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return Response.json({ error: "Missing 'url'" }, { status: 400 });
    }

    const cleanUrl = url.trim().replace(/\/+$/, "");
    const res = await fetch(`${cleanUrl}/v1/models`);

    if (!res.ok) {
      return Response.json(
        { error: `LM Studio returned HTTP ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to reach LM Studio" },
      { status: 502 },
    );
  }
}
