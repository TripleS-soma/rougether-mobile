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
  // 그 409는 호출부가 "루틴이 남아 있어요"로 접는 예상 상태.
  return apiDelete<void>(`/categories/${id}?mode=${mode}`, undefined, {
    expectedStatuses: [409],
  });
}
