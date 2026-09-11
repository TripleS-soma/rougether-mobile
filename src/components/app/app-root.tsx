import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  fetchCharacters,
  fetchGoals,
  fetchOnboarding,
  getSessionUserId,
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
import { StarterRoutineGate } from '@/components/app/starter-routine-gate';
import { OnboardingScreen, type OnboardingGoal } from '@/components/screens/onboarding-screen';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { useAuth } from '@/hooks/use-auth';
import { useStartTab } from '@/hooks/use-start-tab';
import { SCREEN_FOR_TAB } from '@/components/app/navigation';
import { resetOnboardingMissions } from '@/hooks/use-onboarding-missions';
import { track } from '@/lib/analytics';
import {
  claimLegacyOnboarding,
  loadOnboarding,
  resetOnboarding,
  saveOnboarding,
} from '@/lib/onboarding-store';
import { markAppReady } from '@/lib/app-ready';
import {
  loadStarterRoutineProgress,
  saveStarterRoutineProgress,
  type StarterRoutineProgress,
} from '@/lib/starter-routine-store';

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
  const [starterProgress, setStarterProgress] = useState<StarterRoutineProgress | null>(null);
  const userId = status === 'authed' ? getSessionUserId() : undefined;
  const [loadedUserId, setLoadedUserId] = useState<number | undefined | null>(null);
  // 시작 화면 설정 (#1139) — 셸의 첫 화면. 읽기 전엔 부팅 대기.
  const { tab: startTab } = useStartTab();

  useEffect(() => {
    if (status !== 'authed') return;
    let active = true;
    void (async () => {
      // Local cache + server state + masters in one round; the server may be
      // unreachable (offline) — every remote call degrades to the local cache.
      const [saved, remote, goals, chars, starter] = await Promise.all([
        loadOnboarding(userId),
        fetchOnboarding().catch(() => null),
        fetchGoals().catch(() => [] as GoalItem[]),
        fetchCharacters().catch(() => [] as CharacterItem[]),
        loadStarterRoutineProgress(userId),
      ]);
      if (!active) return;
      setCharacters(chars);
      setLoadedUserId(userId);
      setStarterProgress(starter?.status === 'pending' ? starter : null);
      setServerGoals(goals.map(toOnboardingGoal));
      const remoteGoalIds =
        remote?.goals?.flatMap((g) => (g.goalId != null ? [String(g.goalId)] : [])) ?? [];
      /**
       * 기기에 남은 옛 온보딩 기록(계정 구분 없던 키)은 **이 계정 것일 때만** 쓴다
       * (2026-09-11). 앱을 새로 깐 폰에서 새 계정으로 가입했는데 목표 설문도 미션도 없이
       * 앱으로 들어갔다 — 안드로이드 자동 백업이 앞 설치의 이 키를 복원했거나 같은 기기의
       * 앞 계정이 남긴 것이다.
       *
       * 주인 판별: 기록의 목표가 **서버에 저장된 이 계정의 목표와 겹치면** 이 계정 것이다.
       * 같은 온보딩이 로컬(문자열 id)과 서버(goalId)에 함께 저장했기 때문이다 — 캐릭터 저장
       * 409로 completed=false인 옛 사용자도 목표는 서버에 있다. "서버에 목표가 있다"만으로
       * 판정하면 이미 온보딩된 다른 계정이 앞 계정의 기록을 가져갔다(#1299 리뷰). 새 계정은
       * 서버 목표가 비어 있어 당연히 겹치지 않는다. 서버에 못 닿으면(오프라인) 종전대로 믿되
       * 옮기지는 않는다. 확인되면 계정별 키로 옮긴다.
       */
      const legacyOwned =
        saved?.legacy === true &&
        (remote == null || saved.data.goals.some((id) => remoteGoalIds.includes(id)));
      const local = saved && (!saved.legacy || legacyOwned) ? saved.data : null;
      if (saved && legacyOwned && remote != null && userId != null)
        void claimLegacyOnboarding(userId, saved.data);
      const remoteCharacter =
        remote?.selectedCharacterId != null
          ? toAppCharacterId(remote.selectedCharacterId, chars)
          : undefined;
      if (remoteCharacter) setCharacterId(remoteCharacter);
      else if (local) setCharacterId(local.characterId);
      if (remoteGoalIds.length > 0) setSelectedGoalIds(remoteGoalIds);
      else if (local) setSelectedGoalIds(local.goals);
      setOnboarded(remote?.completed === true || local != null);
    })();
    return () => {
      active = false;
    };
  }, [status, userId]);

  const finishStarter = useCallback(
    async (outcome: 'created' | 'skipped' | 'existing') => {
      if (getSessionUserId() !== userId || !starterProgress) return;
      await saveStarterRoutineProgress(userId, { ...starterProgress, status: outcome });
      if (getSessionUserId() === userId) setStarterProgress(null);
    },
    [starterProgress, userId],
  );

  // 캐릭터별 서버 포즈 프레임 (#589·#735) — 온보딩 캐러셀 활성 카드 재생용.
  const characterFrames = useMemo(() => toCharacterFramesMap(characters), [characters]);

  // 참조 고정 — 셸을 거쳐 memo된 SettingsScreen까지 흘러가는 콜백이라
  // AppRoot 리렌더가 설정 화면 memo를 뚫지 않게 한다 (#539 결).
  const replayOnboarding = useCallback(() => {
    void resetOnboarding(getSessionUserId());
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
  const booting =
    status === 'loading' || (status === 'authed' && (onboarded === null || startTab === null));
  if (!booting) markAppReady();

  // 평소엔 스플래시 오버레이가 이 구간을 덮는다. 상한(4초)을 넘겨 오버레이가
  // 먼저 걷힌 경우에만 이 로딩 표시가 드러난다 — 빈 화면 대신.
  if (status === 'loading') return <BootFallback />;

  // Not signed in → send to the login route.
  if (status === 'guest') return <Redirect href="/login" />;

  if (onboarded === null || loadedUserId !== userId || startTab === null) return <BootFallback />;

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
          // New users start with one routine; the legacy mission tour is replay-only.
          // 미션 체인은 첫 온보딩·다시 보기 모두 시작한다(2026-09-08). 첫 온보딩은 추천 루틴
          // 게이트(#1149)를 먼저 거치고, 게이트가 닫히면 셸이 마운트되며 배너가 뜬다.
          setJustOnboarded(true);
          if (!replaying) {
            const progress: StarterRoutineProgress = {
              status: 'pending',
              goals: goals.map(
                (id) => serverGoals.find((goal) => goal.id === id) ?? { id, label: id },
              ),
            };
            setStarterProgress(progress);
            void saveStarterRoutineProgress(userId, progress);
          }
          // 퍼널 (#799) — 목표·캐릭터·닉네임까지 마친 지점. 닉네임은 값이
          // 아니라 입력 여부만 남긴다(개인정보를 분석 도구로 흘리지 않는다).
          track('onboarding_complete', {
            character: chosen,
            goals: goals.length,
            nickname: nickname ? 'set' : 'skipped',
          });
          void saveOnboarding({ characterId: chosen, goals }, userId);
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

  if (starterProgress?.status === 'pending') {
    return (
      <StarterRoutineGate
        key={userId}
        userId={userId}
        goals={starterProgress.goals}
        onFinish={finishStarter}
      />
    );
  }

  return (
    <AppShell
      initialScreen={SCREEN_FOR_TAB[startTab]}
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
