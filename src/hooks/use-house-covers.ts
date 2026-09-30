/**
 * House cover catalog (server GET /houses/cover-images). Failure is non-fatal:
 * the create/edit forms simply hide the cover section.
 *
 * `enabled`가 처음 true가 될 때 받는다 (성능 장부 N3) — 예전엔 앱 시작마다 받았다.
 * 운영자가 바꾸는 카탈로그라 세션 동안 다시 받지 않는다.
 */
import { useQuery } from '@tanstack/react-query';

import { fetchHouseCoverImages } from '@/api';
import { toHouseCover } from '@/api/adapters';
import type { HouseCover } from '@/components/room/house-cover-picker';
import { queryKeys } from '@/lib/query-keys';

const NO_COVERS: HouseCover[] = [];
const toCovers = (items: Awaited<ReturnType<typeof fetchHouseCoverImages>>) =>
  items.map(toHouseCover).filter((c): c is HouseCover => c !== null);

export function useHouseCovers(enabled = true) {
  const { data } = useQuery({
    queryKey: queryKeys.houseCovers,
    queryFn: fetchHouseCoverImages,
    select: toCovers,
    enabled,
    staleTime: Infinity,
  });
  return { covers: data ?? NO_COVERS };
}
