/**
 * Owned characters + the worn one (server GET /me/characters). Loads on mount;
 * `select` swaps the worn character optimistically (PUT /me/characters/select)
 * and rolls back on failure. `selectedCharacterId` overrides the onboarding
 * character once the server list lands.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchMyCharacters, selectCharacter } from '@/api';
import { toOwnedCharacter } from '@/api/adapters';
import { useToast } from '@/components/ui/toast';
import type { OwnedCharacter } from '@/components/screens/sheets/character-picker-sheet';

export function useMyCharacters() {
  // undefined until the first load lands — distinguishes "loading" from
  // "owns none" (the picker entry stays hidden while undefined).
  const [characters, setCharacters] = useState<OwnedCharacter[] | undefined>(undefined);
  const { show: toast } = useToast();

  const load = useCallback(async () => {
    try {
      const items = await fetchMyCharacters();
      setCharacters(items.map(toOwnedCharacter).filter((c): c is OwnedCharacter => c !== null));
    } catch {
      // Non-fatal: the room falls back to the onboarding character.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Wear a character (optimistic — exactly one selected at a time).
   * useCallback: 셸이 memo 화면(MyRoomScreen)의 콜백 안에 넣는다 (#539) —
   * 롤백용 스냅샷은 최신값 ref에서 읽어 characters 의존(참조 변동)을 없앤다.
   * (함수형 업데이트 안에서 스냅샷을 읽으면 빠른 실패 시 커밋 전에 catch가
   * 먼저 돌아 undefined로 롤백된다.)
   */
  const charactersRef = useRef(characters);
  charactersRef.current = characters;
  const select = useCallback(
    async (serverId: number) => {
      const before = charactersRef.current;
      setCharacters(before?.map((c) => ({ ...c, selected: c.serverId === serverId })));
      try {
        await selectCharacter(serverId);
        toast('캐릭터를 교체했어요', 'success');
      } catch {
        setCharacters(before);
        toast('캐릭터 교체에 실패했어요', 'error');
      }
    },
    [toast],
  );

  // The worn character, once the server list has loaded. Its CDN animation
  // keys ride along so the room can render the server art (#263).
  const selectedCharacter = characters?.find((c) => c.selected);

  return {
    characters,
    selectedCharacterId: selectedCharacter?.id,
    selectedCharacterAnimations: selectedCharacter?.animations,
    reload: load,
    select,
  };
}
