import type { AnnouncementAudio } from "../../shared/api";

function getApiKey(): string | null {
  const candidateNames = [
    "WELLSAID_API_KEY",
    "WELLSAIDLABS_API_KEY",
    "wellsaidlabs_API_Key",
    "WELLSAIDLABS__API_KEY",
  ];
  const env = process.env as Record<string, string | undefined>;
  for (const name of candidateNames) {
    const value = env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function requestWellSaidSpeech(
  text: string,
  options?: { model?: string; speakerId?: number },
): Promise<AnnouncementAudio | null> {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return null;
    const model = options?.model || "caruso";
    const speakerId = options?.speakerId ?? 50;
    const res = await fetch("https://api.wellsaidlabs.com/v1/tts/stream", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, model, speaker_id: speakerId }),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { mimeType: "audio/mpeg", base64 };
  } catch {
    return null;
  }
}
