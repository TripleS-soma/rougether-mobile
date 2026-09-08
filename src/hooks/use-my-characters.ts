/**
 * Owned characters + the worn one (server GET /me/characters). `select` swaps
 * the worn character optimistically (PUT /me/characters/select) and rolls
 * back on failure. `selectedCharacterId` overrides the onboarding character
 * once the server list lands.
 *
 * react-query로 이관 (#1027). 목록은 `queryKeys.myCharacters` 캐시에 살고,
 * 뽑기로 캐릭터를 얻으면 `useGacha`가 그 키를 무효화한다 — 셸이 `reload`를
 * 손으로 부르던 배선이 사라졌다. 낙관 교체는 캐시에 쓰고 실패 시 스냅샷으로
 * 되돌린다(`onMutate`/`onError`).
 */
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyCharacters, getSessionUserId, selectCharacter } from '@/api';
import { toOwnedCharacter } from '@/api/adapters';
import type { MyCharacterItem } from '@/api/types';
import { useToast } from '@/components/ui/toast';
import type { OwnedCharacter } from '@/components/screens/sheets/character-picker-sheet';
import { queryKeys } from '@/lib/query-keys';

/** 서버 목록 → 피커 항목 — 모듈 스코프에 두어 react-query가 결과를 메모한다. */
const selectOwned = (items: MyCharacterItem[]): OwnedCharacter[] =>
  items.map(toOwnedCharacter).filter((c): c is OwnedCharacter => c !== null);

export function useMyCharacters() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  const userId = getSessionUserId();
  const queryKey = useMemo(() => queryKeys.myCharacters.byUser(userId), [userId]);

  // undefined until the first load lands — distinguishes "loading" from
  // "owns none" (the picker entry stays hidden while undefined). Load failure
  // is non-fatal: the room falls back to the onboarding character.
  const { data: characters } = useQuery({
    queryKey,
    queryFn: fetchMyCharacters,
    select: selectOwned,
  });

  const { mutateAsync } = useMutation({
    mutationFn: selectCharacter,
    // 낙관 교체 — 캐시(서버 모양)를 바로 바꾸고 스냅샷을 컨텍스트로 넘긴다.
    onMutate: async (serverId) => {
      await qc.cancelQueries({ queryKey });
      const before = qc.getQueryData<MyCharacterItem[]>(queryKey);
      qc.setQueryData<MyCharacterItem[]>(queryKey, (prev) =>
        prev?.map((c) => ({ ...c, selected: c.characterId === serverId })),
      );
      return { before };
    },
    onError: (_err, _serverId, ctx) => {
      qc.setQueryData(queryKey, ctx?.before);
      toast('캐릭터 교체에 실패했어요', 'error');
    },
    onSuccess: () => toast('캐릭터를 교체했어요', 'success'),
  });

  /**
   * Wear a character (optimistic — exactly one selected at a time).
   * 참조 안정 (#539): 셸이 memo 화면(MyRoomScreen)의 콜백 안에 넣는다 —
   * `mutateAsync`만 꺼내 쓰므로 의존성이 흔들리지 않는다.
   */
  const select = useCallback(
    async (serverId: number) => {
      try {
        await mutateAsync(serverId);
      } catch {
        // onError가 이미 되돌리고 안내했다.
      }
    },
    [mutateAsync],
  );

  // The worn character, once the server list has loaded. Its registered pose
  // frames ride along so the room can render the server art (#263, #735).
  const selectedCharacter = characters?.find((c) => c.selected);
  const selectedCharacterId = selectedCharacter?.id;
  const selectedCharacterFrames = selectedCharacter?.frames;

  return useMemo(
    () => ({ characters, selectedCharacterId, selectedCharacterFrames, select }),
    [characters, selectedCharacterId, selectedCharacterFrames, select],
  );
}
