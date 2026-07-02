/** Todo + todo-completion endpoints. */
import { apiDelete, apiGet, apiGetList, apiPost, apiPut } from './client';
import { buildQuery } from './http';
import type {
  TodoCompleteResponse,
  TodoCreateRequest,
  TodoResponse,
  TodoUpdateRequest,
} from './types';

export type TodoFilter = {
  categoryId?: number;
  status?: 'PENDING' | 'COMPLETED';
  /** "YYYY-MM-DD" */
  dueDate?: string;
};

/** GET /todos — the user's todos, optionally filtered by date/category/status. */
export function fetchTodos(filter: TodoFilter = {}) {
  return apiGetList<TodoResponse>(`/todos${buildQuery(filter)}`);
}

/** GET /todos/{id}. */
export function fetchTodo(id: number) {
  return apiGet<TodoResponse>(`/todos/${id}`);
}

/** POST /todos. */
export function createTodo(body: TodoCreateRequest) {
  return apiPost<TodoResponse>('/todos', body);
}

/** PUT /todos/{id}. */
export function updateTodo(id: number, body: TodoUpdateRequest) {
  return apiPut<TodoResponse>(`/todos/${id}`, body);
}

/** DELETE /todos/{id}. */
export function deleteTodo(id: number) {
  return apiDelete<void>(`/todos/${id}`);
}

/** POST /todos/{id}/complete. */
export function completeTodo(id: number) {
  return apiPost<TodoCompleteResponse>(`/todos/${id}/complete`);
}

/** DELETE /todos/{id}/complete — undo completion. */
export function uncompleteTodo(id: number) {
  return apiDelete<void>(`/todos/${id}/complete`);
}
