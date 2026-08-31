import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

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
import { useResolvedScheme, useTokens } from '@/hooks/use-tokens';
import { SplashBackground, SplashBackgroundDark } from '@/constants/theme';
import { AppShell } from '@/components/app/app-shell';
import { OnboardingScreen, type OnboardingGoal } from '@/components/screens/onboarding-screen';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { useAuth } from '@/hooks/use-auth';
import { resetOnboardingMissions } from '@/hooks/use-onboarding-missions';
import { track } from '@/lib/analytics';
import { loadOnboarding, resetOnboarding, saveOnboarding } from '@/lib/onboarding-store';
import { markAppReady } from '@/lib/app-ready';

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
  // 설정 → '튜토리얼 다시 보기'로 되돌아온 세션인지 (#1023). 첫 실행과 다시
  // 보기는 `onboarded === false`로 같아서 이 플래그 없이는 구분되지 않는다 —
  // 온보딩의 건너뛰기와 미션 배너의 건너뛰기가 둘 다 이 값으로 열린다.
  const [replaying, setReplaying] = useState(false);
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
    setReplaying(true);
    setOnboarded(false);
  }, []);

  /**
   * 다시 보기에서 건너뛰기 (#1023) — 슬라이드만 보러 들어왔다 나가는 경로다.
   * 목표·닉네임·캐릭터는 이미 서버에 있으므로 아무것도 다시 쓰지 않고 화면만
   * 닫는다. `justOnboarded`를 세우지 않으므로 미션 체인도 시작하지 않는다.
   */
  const skipReplay = useCallback(() => setOnboarded(true), []);

  // 두 관문(세션 복원 → 온보딩 플래그)이 끝나야 그릴 수 있다. 둘 다 통과하면
  // 스플래시에 알린다 (#847) — 오버레이가 시간이 아니라 이 신호를 기다린다.
  const booting = status === 'loading' || (status === 'authed' && onboarded === null);
  if (!booting) markAppReady();

  // 평소엔 스플래시 오버레이가 이 구간을 덮는다. 상한(4초)을 넘겨 오버레이가
  // 먼저 걷힌 경우에만 이 로딩 표시가 드러난다 — 빈 화면 대신.
  if (status === 'loading') return <BootFallback />;

  // Not signed in → send to the login route.
  if (status === 'guest') return <Redirect href="/login" />;

  if (onboarded === null) return <BootFallback />;

  if (!onboarded) {
    return (
      <OnboardingScreen
        goals={serverGoals.length > 0 ? serverGoals : undefined}
        initialGoals={selectedGoalIds}
        initialCharacterId={characterId}
        characterFrames={characterFrames}
        replay={replaying}
        onSkip={skipReplay}
        onDone={(goals, chosen, nickname) => {
          setCharacterId(chosen);
          setSelectedGoalIds(goals);
          setOnboarded(true);
          // 온보딩을 방금 마침 — 셸이 온보딩 미션 체인을 시작한다 (#571).
          setJustOnboarded(true);
          // 퍼널 (#799) — 목표·캐릭터·닉네임까지 마친 지점. 닉네임은 값이
          // 아니라 입력 여부만 남긴다(개인정보를 분석 도구로 흘리지 않는다).
          track('onboarding_complete', {
            character: chosen,
            goals: goals.length,
            nickname: nickname ? 'set' : 'skipped',
          });
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
      characterFrames={characterFrames}
      startMissions={justOnboarded}
      missionSkipEnabled={replaying}
      onReplayOnboarding={replayOnboarding}
    />
  );
}

/**
 * 부팅 중 자리 (#847) — 예전엔 `return null`이라 스플래시가 먼저 걷히면 빈
 * 화면이 드러났다. 스플래시와 같은 배경색이라 오버레이가 정상적으로 덮는
 * 동안에는 보이지 않고, 상한을 넘겨 걷힌 경우에만 로딩 표시로 나타난다.
 */
function BootFallback() {
  const scheme = useResolvedScheme();
  const t = useTokens();
  return (
    <View
      style={[
        bootStyles.fill,
        { backgroundColor: scheme === 'dark' ? SplashBackgroundDark : SplashBackground },
      ]}>
      <ActivityIndicator color={t.primary} />
    </View>
  );
}

const bootStyles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
