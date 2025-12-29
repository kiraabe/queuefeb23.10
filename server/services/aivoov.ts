import { Buffer } from "node:buffer";
import { URLSearchParams } from "node:url";

export interface AivoovAudioPayload {
  mimeType: string;
  base64: string;
}

const API_ENDPOINT = "https://aivoov.com/api/v1/transcribe";
const DEFAULT_VOICE_ID = "am-ET-AmehaNeural";
const DEFAULT_ENGINE = "neural";

const cache = new Map<string, AivoovAudioPayload>();

function getApiKey(): string | undefined {
  return process.env.AIVOOV_API_KEY?.trim() || undefined;
}

export async function requestAivoovSpeech(
  sentence: string,
  voiceId: string = DEFAULT_VOICE_ID,
): Promise<AivoovAudioPayload | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const cached = cache.get(sentence);
  if (cached) return cached;

  const params = new URLSearchParams();
  params.append("voice_id", voiceId);
  params.append("engine", DEFAULT_ENGINE);
  params.append("transcribe_text[]", sentence);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Aivoov TTS request failed", response.status, text);
      return null;
    }

    const mimeType = response.headers.get("content-type") || "audio/mpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const payload: AivoovAudioPayload = { mimeType, base64 };
    cache.set(sentence, payload);
    return payload;
  } catch (error) {
    console.error("Aivoov TTS request error", error);
    return null;
  }
}
