import { NextRequest } from "next/server";
import OpenAI from "openai";
import { CopilotClient } from "@github/copilot-sdk";
import { MongoClient } from "mongodb";

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, settings } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'message'" }), {
        status: 400,
      });
    }

    let answer = "";
    let modelUsed = "gpt-3.5-turbo"; // default
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    const llmSettings = settings?.llm || {};
    const provider = llmSettings.provider as string | undefined;
    const legacySelectedModel = llmSettings.selectedModel as string | undefined;
    const useLmStudio =
      provider === "lmstudio" || (!provider && legacySelectedModel === "local-model");
    const useCopilot = provider === "copilot";

    const llmStart = Date.now();

    // Determine which LLM to use based on settings
    if (useCopilot) {
      // Use GitHub Copilot SDK
      const githubToken =
        llmSettings.copilot?.githubToken ||
        process.env.GITHUB_TOKEN;

      const copilotModel =
        llmSettings.copilot?.model || "gpt-4.1";

      const clientOptions: Record<string, unknown> = {};
      if (githubToken) {
        clientOptions.githubToken = githubToken;
      } else {
        // Fall back to logged-in GitHub CLI user
        clientOptions.useLoggedInUser = true;
      }

      const client = new CopilotClient(clientOptions);
      try {
        await client.start();
        const session = await client.createSession({ model: copilotModel });
        try {
          // Send system instruction as first message, then user message
          const systemPrompt = settings.systemInstruction || "You are a helpful assistant.";
          const fullPrompt = `${systemPrompt}\n\nUser: ${message}`;

          const response = await session.sendAndWait({ prompt: fullPrompt });
          answer = response?.data?.content ?? "";
          modelUsed = copilotModel;
          // Token usage is not available from the Copilot SDK
        } finally {
          await session.destroy();
        }
      } finally {
        await client.stop();
      }
    } else if (useLmStudio) {
      // Use LM Studio or similar local API
      const lmstudioUrl =
        llmSettings.lmstudio?.url ||
        llmSettings.lmstudioUrl ||
        "http://localhost:1234";
      const lmModel =
        llmSettings.lmstudio?.model ||
        llmSettings.lmstudioModel ||
        "local-model";
      const response = await fetch(`${lmstudioUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: lmModel,
          messages: [
            { role: "system", content: settings.systemInstruction || "You are a helpful assistant." },
            { role: "user", content: message },
          ],
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      answer = data.choices[0]?.message?.content ?? "";
      modelUsed = lmModel;
      promptTokens = data.usage?.prompt_tokens ?? 0;
      completionTokens = data.usage?.completion_tokens ?? 0;
      totalTokens = data.usage?.total_tokens ?? 0;
    } else {
      // Use OpenAI
      const openaiApiKey =
        llmSettings.openai?.apiKey ||
        llmSettings.openaiApiKey ||
        process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error("OpenAI API key not provided and not found in environment variables");
      }

      const openai = new OpenAI({ apiKey: openaiApiKey });

      const openaiModel =
        llmSettings.openai?.model ||
        llmSettings.openaiModel ||
        legacySelectedModel ||
        "gpt-3.5-turbo";

      const completion = await openai.chat.completions.create({
        model: openaiModel,
        messages: [
          { role: "system", content: settings.systemInstruction || "You are a helpful assistant." },
          { role: "user", content: message },
        ],
      });

      answer = completion.choices[0]?.message?.content ?? "";
      modelUsed = openaiModel;
      promptTokens = completion.usage?.prompt_tokens ?? 0;
      completionTokens = completion.usage?.completion_tokens ?? 0;
      totalTokens = completion.usage?.total_tokens ?? 0;
    }

    const llmMs = Date.now() - llmStart;

    // Store in Mongo (best-effort; failures should not block responses)
    let logged = false;
    let dbMs: number | null = null;
    try {
      const dbSettings = settings?.database || {};
      const mongoUri =
        dbSettings.mongoUri ||
        process.env.MONGO_URI;
      const mongoDb =
        dbSettings.mongoDb ||
        process.env.MONGO_DB ||
        "chat_logs";

      if (mongoUri) {
        const dbStart = Date.now();
        const client = new MongoClient(mongoUri);
        try {
          await client.connect();
          const db = client.db(mongoDb);
          const doc = {
            sessionId: sessionId || null,
            question: message,
            answer,
            model: modelUsed,
            createdAt: new Date(),
          };
          await db.collection("logs").insertOne(doc);
          logged = true;
        } finally {
          await client.close();
        }
        dbMs = Date.now() - dbStart;
      } else {
        console.warn("Mongo logging skipped: no MongoDB configuration provided.");
      }
    } catch (logErr) {
      console.error("Mongo logging failed", logErr);
    }

    const tokensPerSecond = completionTokens > 0 && llmMs > 0
      ? Math.round((completionTokens / (llmMs / 1000)) * 10) / 10
      : null;

    return Response.json({
      answer,
      logged,
      stats: {
        provider: useCopilot ? "copilot" : useLmStudio ? "lmstudio" : "openai",
        model: modelUsed,
        llmMs,
        dbMs,
        promptTokens,
        completionTokens,
        totalTokens,
        tokensPerSecond,
      },
    });
  } catch (err: unknown) {
    console.error("/api/chat error", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unexpected error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}
