import { notifyAppIconEvent } from '@/lib/app-icon-events';
/** Todo + todo-completion endpoints. */
import { apiDelete, apiGetList, apiPost, apiPut } from './client';
import { buildQuery } from './http';
import type {
  RoutineResponse,
  TodoCompleteResponse,
  TodoConvertRequest,
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

/** POST /todos. */
export function createTodo(body: TodoCreateRequest) {
  return apiPost<TodoResponse>('/todos', body);
}

/** PUT /todos/{id}. */
export function updateTodo(id: number, body: TodoUpdateRequest) {
  return apiPut<TodoResponse>(`/todos/${id}`, body);
}

/**
 * POST /todos/{id}/convert-to-routine — 미완료 투두를 반복 루틴으로 바꾼다. 서버가 루틴 생성과
 * 투두 삭제를 한 트랜잭션으로 처리하고 새 루틴을 돌려준다. 완료한 투두는 409
 * `TODO_COMPLETED_NOT_CONVERTIBLE`.
 */
export function convertTodoToRoutine(id: number, body: TodoConvertRequest) {
  return apiPost<RoutineResponse>(`/todos/${id}/convert-to-routine`, body);
}

/** DELETE /todos/{id}. */
export function deleteTodo(id: number) {
  return apiDelete<void>(`/todos/${id}`);
}

/** POST /todos/{id}/complete. */
export function completeTodo(id: number) {
  return apiPost<TodoCompleteResponse>(`/todos/${id}/complete`).then((result) => {
    notifyAppIconEvent('completion');
    return result;
  });
}

/** DELETE /todos/{id}/complete — undo completion. */
export function uncompleteTodo(id: number) {
  return apiDelete<void>(`/todos/${id}/complete`).then((result) => {
    notifyAppIconEvent('completion');
    return result;
  });
}
