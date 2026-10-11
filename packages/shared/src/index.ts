/** Shared types and DTOs for all workspaces. */

export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: { message: string };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;
