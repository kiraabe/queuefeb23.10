import { CambAI, ApiKey, Languages, OutputType } from "cambai";

import type { AnnouncementAudio } from "@shared/api";

const DEFAULT_VOICE_ID = 20299;
const REQUEST_TIMEOUT_SECONDS = 60;
const LANGUAGE_AMHARIC = Languages.NUMBER_3;

let client: CambAI | null = null;
const audioCache = new Map<string, AnnouncementAudio>();

function getApiKey(): string | undefined {
  return process.env.CAMB_AI_API_KEY?.trim() || undefined;
}

function getClient(): CambAI | null {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  if (!client) {
    client = new CambAI();
    client.setApiKey(ApiKey.APIKeyHeader, apiKey);
  }
  return client;
}

export async function requestCambAiSpeech(
  sentence: string,
  voiceId: number = DEFAULT_VOICE_ID,
): Promise<AnnouncementAudio | null> {
  const trimmed = sentence.trim();
  if (!trimmed) return null;

  const cached = audioCache.get(trimmed);
  if (cached) return cached;

  const cambAI = getClient();
  if (!cambAI) return null;

  try {
    const result = await cambAI.textToSpeech(
      trimmed,
      voiceId,
      LANGUAGE_AMHARIC,
      REQUEST_TIMEOUT_SECONDS,
      OutputType.RawBytes,
    );

    const buffer =
      result instanceof Buffer
        ? result
        : typeof result === "string"
          ? Buffer.from(result, "base64")
          : Buffer.from([]);

    if (buffer.length === 0) return null;

    const payload: AnnouncementAudio = {
      mimeType: "audio/mpeg",
      base64: buffer.toString("base64"),
    };

    audioCache.set(trimmed, payload);
    return payload;
  } catch (error) {
    console.error("CambAI TTS request error", error);
    return null;
  }
}
