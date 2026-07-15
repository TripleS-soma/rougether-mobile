/**
 * Owned characters + the worn one (server GET /me/characters). Loads on mount;
 * `select` swaps the worn character optimistically (PUT /me/characters/select)
 * and rolls back on failure. `selectedCharacterId` overrides the onboarding
 * character once the server list lands.
 */
import { useCallback, useEffect, useState } from 'react';

import { fetchMyCharacters, selectCharacter } from '@/api';
import { toOwnedCharacter } from '@/api/adapters';
import { useToast } from '@/components/ui/toast';
import type { OwnedCharacter } from '@/components/screens/sheets/character-picker-sheet';

export function useMyCharacters() {
  const [characters, setCharacters] = useState<OwnedCharacter[]>([]);
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

  /** Wear a character (optimistic — exactly one selected at a time). */
  const select = async (serverId: number) => {
    const before = characters;
    setCharacters((prev) => prev.map((c) => ({ ...c, selected: c.serverId === serverId })));
    try {
      await selectCharacter(serverId);
      toast('캐릭터를 교체했어요', 'success');
    } catch {
      setCharacters(before);
      toast('캐릭터 교체에 실패했어요', 'error');
    }
  };

  /** The worn character's app id, once the server list has loaded. */
  const selectedCharacterId = characters.find((c) => c.selected)?.id;

  return { characters, selectedCharacterId, reload: load, select };
}
