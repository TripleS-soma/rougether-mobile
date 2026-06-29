import { http, HttpResponse } from 'msw';

import { API_BASE } from '@/api/client';

import { RECOMMENDED_HOUSES } from './fixtures';

/** MSW request handlers for the Rougether business API. */
export const handlers = [
  http.get(`${API_BASE}/houses/recommended`, () =>
    HttpResponse.json({ items: RECOMMENDED_HOUSES }),
  ),
];
