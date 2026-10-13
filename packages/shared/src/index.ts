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
