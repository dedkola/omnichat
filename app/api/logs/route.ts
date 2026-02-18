import { NextRequest } from "next/server";
import { MongoClient } from "mongodb";

export async function GET() {
  // Env-based fallback for environments that still use MONGO_URI/MONGO_DB.
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    return Response.json({ logs: [] });
  }

  const mongoDb = process.env.MONGO_DB || "chat_logs";
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db(mongoDb);
    const logs = await db
      .collection("logs")
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return Response.json({ logs });
  } finally {
    await client.close();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { settings, search } = await req.json();
    const dbSettings = settings?.database || {};

    const mongoUri =
      dbSettings.mongoUri ||
      process.env.MONGO_URI;
    const mongoDb =
      dbSettings.mongoDb ||
      process.env.MONGO_DB ||
      "chat_logs";

    if (!mongoUri) {
      return new Response(
        JSON.stringify({
          error:
            "MongoDB is not configured. Set it in Settings (Database tab) or via MONGO_URI.",
        }),
        { status: 400 }
      );
    }

    const client = new MongoClient(mongoUri);
    try {
      await client.connect();
      const db = client.db(mongoDb);
      const col = db.collection("logs");

      const searchTerm =
        search && typeof search === "string" ? search.trim() : "";

      if (searchTerm) {
        // Search: simple filter across all logs, limit 200 so grouping works
        const logs = await col
          .find(
            {
              $or: [
                { question: { $regex: searchTerm, $options: "i" } },
                { answer: { $regex: searchTerm, $options: "i" } },
              ],
            },
            { projection: { _id: 0 } },
          )
          .sort({ createdAt: -1 })
          .limit(200)
          .toArray();
        return Response.json({ logs });
      }

      // History (no search): find the 50 most-recent sessions, then fetch
      // ALL their logs so grouping in the sidebar always has the full thread.
      //
      // Step 1 – find the 50 latest sessionIds (by their most-recent message).
      //   Logs without a sessionId are treated as their own "session" keyed by
      //   a synthetic id so they still show up.
      const recentSessions = await col
        .aggregate<{ _id: string | null; latestAt: string }>([
          {
            $group: {
              _id: "$sessionId",
              latestAt: { $max: "$createdAt" },
            },
          },
          { $sort: { latestAt: -1 } },
          { $limit: 50 },
        ])
        .toArray();

      const sessionIds = recentSessions
        .map((s) => s._id)
        .filter((id): id is string => typeof id === "string");

      const hasNullSessions = recentSessions.some((s) => s._id === null);

      // Step 2 – fetch every log that belongs to one of those sessions.
      const filter: Record<string, unknown> = hasNullSessions
        ? { $or: [{ sessionId: { $in: sessionIds } }, { sessionId: null }, { sessionId: { $exists: false } }] }
        : { sessionId: { $in: sessionIds } };

      const logs = await col
        .find(filter, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .toArray();

      return Response.json({ logs });
    } finally {
      await client.close();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
    });
  }
}
