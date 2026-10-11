/** Shared types and DTOs for all workspaces. */

export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

/** Payload for creating a todo. */
export interface CreateTodo {
  title: string;
}

/** Payload for updating a todo (partial). */
export interface UpdateTodo {
  title?: string;
  done?: boolean;
}

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
