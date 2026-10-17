/**
 * statusService (Story-0037) – probes LLM / database / voice in parallel
 * and reports their reachability for the UI status dot and the
 * Settings → Verbindung diagnostics tab.
 *
 * Security: responses contain endpoints (host:port) and error details only –
 * never API keys, DB passwords or other credentials.
 */
import { networkInterfaces } from 'node:os';
import type { ApiInstanceInfo, DatabaseStatus, LlmStatus, SystemStatus, VoiceStatus } from 'shared';
import { env } from '../env';
import { getPool } from './pgPool';
import { getProviderName } from './chatService';
import { VOICE_SERVICE_URL, probeVoice } from './voiceClient';

const PROBE_TIMEOUT_MS = 5000;

/** Local non-internal IPv4 address (e.g. 172.17.0.3 in a container). */
function getLocalIp(): string | undefined {
  const nets = networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return undefined;
}

/** The API instance itself (bind host + port + local IP). */
function getApiInstance(): ApiInstanceInfo {
  return { host: env.HOST, port: env.PORT, ip: getLocalIp() };
}

/** Resolve the configured LLM endpoint + model (same defaults as the provider). */
function llmConfig() {
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'http://localhost:1234/v1';
  const model = process.env.OPENAI_MODEL ?? 'local-model';
  return { baseUrl, model };
}

/** LLM probe – mock providers are healthy by definition (no remote service). */
export async function probeLlm(): Promise<LlmStatus> {
  if (getProviderName() !== 'openai') {
    return {
      ok: true,
      configured: true,
      provider: 'mock',
      detail: 'Mock-Provider aktiv (kein externer LLM-Dienst konfiguriert)',
    };
  }

  const { baseUrl, model } = llmConfig();
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url = new URL('models', trimmed + '/');
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(url.toString(), PROBE_TIMEOUT_MS);
    const latencyMs = Date.now() - started;
    if (res.ok) {
      return {
        ok: true,
        configured: true,
        provider: 'openai',
        endpoint: baseUrl,
        model,
        latencyMs,
      };
    }
    const hint = res.status === 401 || res.status === 403 ? ' – Auth prüfen' : '';
    return {
      ok: false,
      configured: true,
      provider: 'openai',
      endpoint: baseUrl,
      model,
      latencyMs,
      detail: `LLM antwortete mit HTTP ${res.status}${hint}`,
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      provider: 'openai',
      endpoint: baseUrl,
      model,
      detail: `LLM nicht erreichbar: ${describeError(err)}`,
    };
  }
}

/** Database probe – SELECT 1 against the configured pool. */
export async function probeDatabase(): Promise<DatabaseStatus> {
  if (!env.DATABASE_URL) {
    return {
      ok: false,
      configured: false,
      detail: 'DATABASE_URL nicht gesetzt (Persistenz deaktiviert)',
    };
  }
  const endpoint = endpointOf(env.DATABASE_URL);
  const started = Date.now();
  try {
    const pool = getPool();
    if (!pool) throw new Error('Pool nicht verfügbar');
    await withTimeout(pool.query('SELECT 1'), PROBE_TIMEOUT_MS);
    return { ok: true, configured: true, endpoint, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      endpoint,
      detail: `Datenbank nicht erreichbar: ${describeError(err)}`,
    };
  }
}

/** Voice probe – reuses the voz sidecar health endpoint. */
export async function probeVoiceStatus(): Promise<VoiceStatus> {
  const result = await probeVoice(PROBE_TIMEOUT_MS);
  if (result.ok && result.health) {
    return {
      ok: true,
      configured: true,
      tts: result.health.tts === true,
      stt: result.health.stt === true,
      endpoint: VOICE_SERVICE_URL,
      detail: 'voz-Sidecar erreichbar',
    };
  }
  return {
    ok: false,
    configured: true,
    tts: false,
    stt: false,
    endpoint: VOICE_SERVICE_URL,
    detail: result.detail ?? 'voz-Sidecar nicht erreichbar',
  };
}

/** Runs all probes in parallel and assembles the SystemStatus payload. */
export async function getSystemStatus(): Promise<SystemStatus> {
  const [llm, database, voice] = await Promise.all([
    probeLlm(),
    probeDatabase(),
    probeVoiceStatus(),
  ]);
  return { uptime: Math.round(process.uptime()), api: getApiInstance(), llm, database, voice };
}

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Rejects if the promise does not settle within timeoutMs. */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout (${timeoutMs / 1000} s)`)), timeoutMs);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** host:port of a postgres:// URL – credentials are stripped. */
function endpointOf(databaseUrl: string): string | undefined {
  try {
    const url = new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, 'http://'));
    return url.port ? `${url.hostname}:${url.port}` : url.hostname;
  } catch {
    return undefined;
  }
}

/** Turns a failure into a short, safe diagnostic string. */
function describeError(err: unknown): string {
  const cause = (err as { cause?: { code?: string } } | null)?.cause;
  if (cause?.code) return cause.code;
  if (err instanceof DOMException && err.name === 'AbortError')
    return `timeout (${PROBE_TIMEOUT_MS / 1000} s)`;
  return err instanceof Error ? err.message : String(err);
}
