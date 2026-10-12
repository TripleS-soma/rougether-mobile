/**
 * 내 프로필(닉네임·소개) — react-query 캐시 (장부 16번, use-my-room-data 조각).
 *
 * 스스로 받지 않는다(`enabled: false`): 값은 나의 방 부트 묶음의 `GET /me`가 `seedProfile`로
 * 넣고, 저장(`saveProfile`, PUT /me)은 낙관적으로 먼저 그린 뒤 실패하면 되돌린다.
 *
 * 함수는 전부 참조가 고정이고, 세션 사용자는 **호출 시점에** 읽는다(#1515 — 렌더 시점 id를
 * 의존성에 두면 id가 바뀔 때 함수가 새로 생겨 부트 로드가 다시 돈다).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { fetchMe, getSessionUserId, updateMe } from '@/api';
import { useToast } from '@/components/ui/toast';
import { i18n } from '@/i18n';
import { queryKeys } from '@/lib/query-keys';

export type MyProfile = { nickname: string | null; bio: string | null };
type ProfileSource = { nickname?: string | null; bio?: string | null };

const EMPTY_PROFILE: MyProfile = { nickname: null, bio: null };

/**
 * 받아 둔 값 위에 응답을 얹는다 — 빈 닉네임·null 소개는 "모름"이라 덮지 않는다(예전 부트
 * 로드와 같은 규칙). 빈 문자열 소개는 "지웠다"는 뜻이라 반영한다.
 */
const mergeProfile = (prev: MyProfile | undefined, me: ProfileSource): MyProfile => ({
  nickname: me.nickname || (prev?.nickname ?? null),
  bio: me.bio != null ? me.bio : (prev?.bio ?? null),
});

const fetchProfile = async (): Promise<MyProfile> => mergeProfile(undefined, await fetchMe());

export function useMyProfile() {
  const userId = getSessionUserId();
  const queryClient = useQueryClient();
  const { show: toast } = useToast();
  const { data } = useQuery({
    queryKey: queryKeys.myProfile(userId),
    queryFn: fetchProfile,
    enabled: false,
  });

  /** 부트 묶음의 `GET /me` 응답을 캐시에 넣는다. */
  const seedProfile = useCallback(
    (me: ProfileSource) =>
      queryClient.setQueryData<MyProfile>(queryKeys.myProfile(getSessionUserId()), (prev) =>
        mergeProfile(prev, me),
      ),
    [queryClient],
  );

  /** Persist the profile (PUT /me) — nickname + bio together, optimistic. */
  const saveProfile = useCallback(
    async (nickname: string, bio: string): Promise<boolean> => {
      const key = queryKeys.myProfile(getSessionUserId());
      // 스냅샷은 캐시에서 — 렌더 값은 배칭으로 한 박자 늦을 수 있다(장부 16번 함정 2).
      const before = queryClient.getQueryData<MyProfile>(key) ?? EMPTY_PROFILE;
      queryClient.setQueryData<MyProfile>(key, { nickname, bio });
      try {
        await updateMe({ nickname, bio });
        toast(i18n.t('routineTodo.toast.profileSaved'), 'success');
        return true;
      } catch {
        queryClient.setQueryData<MyProfile>(key, before);
        toast(i18n.t('routineTodo.toast.profileSaveFailed'), 'error');
        return false;
      }
    },
    [queryClient, toast],
  );

  const profile = data ?? EMPTY_PROFILE;
  return { nickname: profile.nickname, bio: profile.bio, seedProfile, saveProfile };
}
