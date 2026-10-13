/**
 * Voice service client – talks to the standalone voz sidecar over HTTP.
 * No external dependencies (uses global fetch, Node 18+).
 *
 * Configuration:
 *   VOICE_SERVICE_URL – base URL of the sidecar (default http://127.0.0.1:8765)
 */

import type { Voice, VoiceCapabilities } from 'shared';

const _raw = process.env.VOICE_SERVICE_URL ?? 'http://127.0.0.1:8765';
const VOICE_URL = _raw.endsWith('/') ? _raw.slice(0, -1) : _raw;
const DEFAULT_TIMEOUT_MS = 2000;

// Short-lived capability cache (avoid hammering the sidecar on every request).
let cachedCapabilities: VoiceCapabilities | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000; // 5 s

interface SidecarHealth {
  tts: boolean;
  stt: boolean;
  voices: Voice[];
  languages: string[];
  default_voice: Record<string, string>;
  error?: string;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Returns the current voice capabilities (tts/stt availability + voices). */
export async function getCapabilities(): Promise<VoiceCapabilities> {
  const now = Date.now();
  if (cachedCapabilities && now - cachedAt < CACHE_TTL_MS) {
    return cachedCapabilities;
  }

  try {
    const res = await fetchWithTimeout(`${VOICE_URL}/health`);
    if (!res.ok) throw new Error(`sidecar health ${res.status}`);
    const health = (await res.json()) as SidecarHealth;
    cachedCapabilities = {
      tts: health.tts === true,
      stt: health.stt === true,
      voices: Array.isArray(health.voices) ? health.voices : [],
      languages: Array.isArray(health.languages) ? health.languages : [],
      defaultVoiceByLanguage: health.default_voice ?? {},
    };
  } catch {
    // Sidecar unreachable → report both as unavailable.
    cachedCapabilities = {
      tts: false,
      stt: false,
      voices: [],
      languages: [],
      defaultVoiceByLanguage: {},
    };
  }
  cachedAt = now;
  return cachedCapabilities;
}

/** Synthesize speech and return the raw audio bytes + content type. */
export async function synthesize(
  text: string,
  voice?: string
): Promise<{ audio: Buffer; contentType: string }> {
  const doSynthesize = () =>
    fetchWithTimeout(
      `${VOICE_URL}/tts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      },
      30000 // TTS can take longer
    );

  // Edge-TTS tokens expire; one retry with a short delay usually succeeds.
  let res = await doSynthesize();
  if (!res.ok && (res.status === 403 || res.status === 500)) {
    await new Promise((r) => setTimeout(r, 500));
    res = await doSynthesize();
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`tts failed: ${res.status} ${body}`.trim());
  }

  const contentType = res.headers.get('content-type') ?? 'audio/mpeg';
  const arrayBuf = await res.arrayBuffer();
  return { audio: Buffer.from(arrayBuf), contentType };
}

/** Transcribe audio bytes to text. */
export async function transcribe(audio: Buffer, language: string): Promise<string> {
  const res = await fetchWithTimeout(
    `${VOICE_URL}/stt?language=${encodeURIComponent(language)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(audio),
    },
    30000 // STT can take longer
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`stt failed: ${res.status} ${body}`.trim());
  }
  const payload = (await res.json()) as { text?: string };
  return (payload.text ?? '').trim();
}

/** Invalidate the capability cache (e.g. after a sidecar restart). */
export function invalidateCapabilitiesCache(): void {
  cachedCapabilities = null;
  cachedAt = 0;
}
