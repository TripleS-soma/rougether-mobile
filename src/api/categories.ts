/** Routine/todo category endpoints. */
import { apiDelete, apiGetList, apiPost, apiPut } from './client';
import { buildQuery } from './http';
import type { CategoryCreateRequest, CategoryResponse, CategoryUpdateRequest } from './types';

/**
 * GET /categories. With includeDeleted, deleted categories come back flagged
 * (`deleted: true`) — needed to resolve past records' original category.
 */
export function fetchCategories(includeDeleted = false) {
  return apiGetList<CategoryResponse>(
    `/categories${buildQuery({ includeDeleted: includeDeleted ? 'true' : undefined })}`,
  );
}

/** POST /categories. */
export function createCategory(body: CategoryCreateRequest) {
  return apiPost<CategoryResponse>('/categories', body);
}

/** PUT /categories/{id}. */
export function updateCategory(id: number, body: CategoryUpdateRequest) {
  return apiPut<CategoryResponse>(`/categories/${id}`, body);
}

/** 카테고리 삭제 모드 (#517) — 서버 필수 쿼리. */
export type CategoryDeleteMode = 'UNASSIGN' | 'PURGE';

/**
 * DELETE /categories/{id}?mode=… — 살아있는 루틴이 있으면 409 CATEGORY_IN_USE.
 * UNASSIGN: 참조하던 옛 루틴·살아있는 투두를 미분류(categoryId null)로 전환.
 * PURGE: 과거 수행 기록·사진 인증을 지우고 살아있는 투두도 삭제.
 */
export function deleteCategory(id: number, mode: CategoryDeleteMode) {
  return apiDelete<void>(`/categories/${id}?mode=${mode}`);
}

/**
 * DELETE /categories/{id}/house-link — 집 연동 해제 (#907).
 * **카테고리와 소속 루틴·투두는 그대로 남는다** — `deleteCategory`와 다르다.
 * 이미 연동이 없어도 성공(멱등).
 *
 * `updateCategory`의 `houseId: null`로는 안 된다 — 그건 "기존 유지"다.
 */
export function unlinkCategoryHouse(id: number) {
  return apiDelete<void>(`/categories/${id}/house-link`);
}
