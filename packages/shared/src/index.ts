/** Shared types and DTOs for all workspaces. */

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: { message: string };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

/** Type guard: narrows ApiResult<T> to ApiError. */
export function isApiError<T>(result: ApiResult<T>): result is ApiError {
  return 'error' in result;
}

/** Type guard: narrows ApiResult<T> to ApiResponse<T>. */
export function isApiSuccess<T>(result: ApiResult<T>): result is ApiResponse<T> {
  return 'data' in result;
}

export interface ChatMessage {
  id: string;
  content: string;
}

/** A single message in the conversation history (role + content only). */
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Request body for POST /api/chat. */
export interface ChatRequest {
  message: string;
  /** Optional: previous conversation messages (oldest → newest). */
  history?: ChatHistoryMessage[];
}

export type ChatResponse = ApiResponse<ChatMessage>;

// ── Voice (TTS + STT) ───────────────────────────────────────────────────────

/** A single TTS voice option. */
export interface Voice {
  id: string;
  name: string;
  gender: 'f' | 'm';
  /** Language code, e.g. "de", "es", "en". */
  language: string;
}

/** Voice capabilities reported by GET /api/voice/capabilities. */
export interface VoiceCapabilities {
  /** Whether TTS (text-to-speech) is available. */
  tts: boolean;
  /** Whether STT (speech-to-text) is available. */
  stt: boolean;
  /** Available TTS voices. */
  voices: Voice[];
  /** Supported STT languages, e.g. ["de", "es", "en"]. */
  languages: string[];
  /** Default voice id per language. */
  defaultVoiceByLanguage: Record<string, string>;
}

/** Request body for POST /api/voice/tts. */
export interface TtsRequest {
  text: string;
  /** Optional voice id (defaults to the language default). */
  voice?: string;
}

/** Request body for POST /api/voice/stt. */
export interface SttRequest {
  /** Base64-encoded audio (e.g. WebM/Opus from MediaRecorder). */
  audio: string;
  /** STT language, e.g. "de". */
  language: string;
}

/** Response body for POST /api/voice/stt (the `data` field). */
export interface SttResult {
  text: string;
}
