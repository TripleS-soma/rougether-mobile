/** Routine/todo category endpoints. */
import { apiDelete, apiGetList, apiPost, apiPut } from './client';
import type { CategoryCreateRequest, CategoryResponse, CategoryUpdateRequest } from './types';

/** GET /categories. */
export function fetchCategories() {
  return apiGetList<CategoryResponse>('/categories');
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
