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

/** DELETE /categories/{id}. */
export function deleteCategory(id: number) {
  return apiDelete<void>(`/categories/${id}`);
}
