import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchCharacters,
  fetchGoals,
  fetchOnboarding,
  saveOnboardingCharacter,
  saveOnboardingGoals,
  updateMe,
} from '@/api';
import {
  toAppCharacterId,
  toCharacterFramesMap,
  toOnboardingGoal,
  toServerCharacterId,
} from '@/api/adapters';
import type { CharacterItem, GoalItem } from '@/api/types';
import { AppShell } from '@/components/app/app-shell';
import { OnboardingScreen, type OnboardingGoal } from '@/components/screens/onboarding-screen';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { useAuth } from '@/hooks/use-auth';
import { resetOnboardingMissions } from '@/hooks/use-onboarding-missions';
import { loadOnboarding, resetOnboarding, saveOnboarding } from '@/lib/onboarding-store';

/**
 * App entry gate: on first launch shows the onboarding flow (intro → goals →
 * character select); afterwards it goes straight to the app with the saved
 * character. Completion lives on the server (GET /onboarding) with the local
 * store as cache/fallback; selections are pushed back via PUT /onboarding/*.
 */
export function AppRoot() {
  const { status } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  // 이 세션에서 온보딩을 갓 마쳤는지 — 미션 체인 자동 시작 신호 (#571).
  const [justOnboarded, setJustOnboarded] = useState(false);
  const [characterId, setCharacterId] = useState<CharacterId>(DEFAULT_CHARACTER_ID);
  const [serverGoals, setServerGoals] = useState<OnboardingGoal[]>([]);
  // Previously selected goal ids — 온보딩 다시 보기 opens the goal survey as an
  // edit of these instead of a blank slate.
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);

  useEffect(() => {
    if (status !== 'authed') return;
    let active = true;
    void (async () => {
      // Local cache + server state + masters in one round; the server may be
      // unreachable (offline) — every remote call degrades to the local cache.
      const [saved, remote, goals, chars] = await Promise.all([
        loadOnboarding(),
        fetchOnboarding().catch(() => null),
        fetchGoals().catch(() => [] as GoalItem[]),
        fetchCharacters().catch(() => [] as CharacterItem[]),
      ]);
      if (!active) return;
      setCharacters(chars);
      setServerGoals(goals.map(toOnboardingGoal));
      const remoteCharacter =
        remote?.selectedCharacterId != null
          ? toAppCharacterId(remote.selectedCharacterId, chars)
          : undefined;
      if (remoteCharacter) setCharacterId(remoteCharacter);
      else if (saved) setCharacterId(saved.characterId);
      const remoteGoalIds =
        remote?.goals?.flatMap((g) => (g.goalId != null ? [String(g.goalId)] : [])) ?? [];
      if (remoteGoalIds.length > 0) setSelectedGoalIds(remoteGoalIds);
      else if (saved) setSelectedGoalIds(saved.goals);
      setOnboarded(remote?.completed === true || saved != null);
    })();
    return () => {
      active = false;
    };
  }, [status]);

  // 캐릭터별 서버 포즈 프레임 (#589·#735) — 온보딩 캐러셀 활성 카드 재생용.
  const characterFrames = useMemo(() => toCharacterFramesMap(characters), [characters]);

  // 참조 고정 — 셸을 거쳐 memo된 SettingsScreen까지 흘러가는 콜백이라
  // AppRoot 리렌더가 설정 화면 memo를 뚫지 않게 한다 (#539 결).
  const replayOnboarding = useCallback(() => {
    void resetOnboarding();
    // 미션 완료/스킵 플래그도 지운다 — 슬라이드 후 체인이 다시 시작 (#571).
    void resetOnboardingMissions();
    setOnboarded(false);
  }, []);

  // Wait for the session check; the splash overlay covers this brief gap.
  if (status === 'loading') return null;

  // Not signed in → send to the login route.
  if (status === 'guest') return <Redirect href="/login" />;

  if (onboarded === null) return null;

  if (!onboarded) {
    return (
      <OnboardingScreen
        goals={serverGoals.length > 0 ? serverGoals : undefined}
        initialGoals={selectedGoalIds}
        initialCharacterId={characterId}
        characterFrames={characterFrames}
        onDone={(goals, chosen, nickname) => {
          setCharacterId(chosen);
          setSelectedGoalIds(goals);
          setOnboarded(true);
          // 온보딩을 방금 마침 — 셸이 온보딩 미션 체인을 시작한다 (#571).
          setJustOnboarded(true);
          void saveOnboarding({ characterId: chosen, goals });
          // Push the selections to the server, best-effort: goal ids are
          // numeric only when the server master supplied them, and the
          // character save can 409 (CHARACTER_NOT_OWNED) for legacy users.
          const goalIds = goals.map(Number).filter((n) => Number.isFinite(n));
          if (goalIds.length > 0) void saveOnboardingGoals(goalIds).catch(() => {});
          const serverCharacterId = toServerCharacterId(chosen, characters);
          if (serverCharacterId != null)
            void saveOnboardingCharacter(serverCharacterId).catch(() => {});
          // 닉네임 저장 (#635) — 신규 계정의 빈 닉네임이 데모 기본값으로
          // 노출되던 문제. best-effort — 실패해도 온보딩은 계속.
          if (nickname) void updateMe({ nickname }).catch(() => {});
        }}
      />
    );
  }

  return (
    <AppShell
      characterId={characterId}
      startMissions={justOnboarded}
      onReplayOnboarding={replayOnboarding}
    />
  );
}
