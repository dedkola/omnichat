import { NextRequest } from "next/server";
import { MongoClient } from "mongodb";

export async function POST(req: NextRequest) {
  try {
    const { settings, sessionIds } = await req.json();
    const dbSettings = settings?.database || {};

    const mongoUri = dbSettings.mongoUri || process.env.MONGO_URI;
    const mongoDb = dbSettings.mongoDb || process.env.MONGO_DB || "chat_logs";

    if (!mongoUri) {
      return new Response(
        JSON.stringify({ error: "MongoDB is not configured." }),
        { status: 400 },
      );
    }

    const client = new MongoClient(mongoUri);
    try {
      await client.connect();
      const db = client.db(mongoDb);
      const collection = db.collection("logs");

      let result;
      if (Array.isArray(sessionIds) && sessionIds.length > 0) {
        // Delete specific sessions by sessionId
        result = await collection.deleteMany({
          sessionId: { $in: sessionIds },
        });
      } else {
        // Delete all
        result = await collection.deleteMany({});
      }

      return Response.json({ deleted: result.deletedCount });
    } finally {
      await client.close();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
