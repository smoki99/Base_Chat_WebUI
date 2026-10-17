// ── System status (Story-0037) ───────────────────────────────────────────────

/**
 * Result of a single service probe (LLM, database, voice sidecar).
 * `detail` is always safe to display – it must never contain credentials.
 */
export interface ServiceStatus {
  /** Service is reachable and answered successfully. */
  ok: boolean;
  /** Service is configured (env var set / provider active). */
  configured: boolean;
  /** Measured probe latency in milliseconds (only when probed). */
  latencyMs?: number;
  /** Short, safe error/info message (never credentials). */
  detail?: string;
}

/** The API instance itself – useful for container network debugging. */
export interface ApiInstanceInfo {
  /** Bind address from the HOST env var (e.g. 127.0.0.1 or 0.0.0.0). */
  host: string;
  /** API port from the PORT env var. */
  port: number;
  /** Local non-internal IPv4 address (e.g. 172.17.0.3), when available. */
  ip?: string;
}

/** LLM provider status (mock = no remote service expected). */
export interface LlmStatus extends ServiceStatus {
  provider: 'mock' | 'openai';
  /** Target endpoint (e.g. http://localhost:1234/v1) – never includes keys. */
  endpoint?: string;
  /** Configured model name (not a secret). */
  model?: string;
}

/** Postgres status – `endpoint` is host:port only, never credentials. */
export interface DatabaseStatus extends ServiceStatus {
  endpoint?: string;
}

/** voz sidecar status. */
export interface VoiceStatus extends ServiceStatus {
  tts: boolean;
  stt: boolean;
  /** Target sidecar URL (e.g. http://127.0.0.1:8765). */
  endpoint?: string;
}

/** Response payload of GET /api/status. */
export interface SystemStatus {
  /** API uptime in seconds. */
  uptime: number;
  /** Own API instance address/port (container debugging). */
  api: ApiInstanceInfo;
  llm: LlmStatus;
  database: DatabaseStatus;
  voice: VoiceStatus;
}
