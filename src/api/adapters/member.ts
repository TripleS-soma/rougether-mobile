/**
 * Member adapters — onboarding goals, character id/frame mapping, owned
 * characters, bug reports, push settings.
 */
import { isCdnKey } from '@/resources/asset';
import { CHARACTER_OPTIONS, type CharacterId } from '@/constants/characters';
import { type OnboardingGoal } from '@/components/screens/onboarding-screen';
import { monthDayLabel } from '@/utils/datetime';
import type { BugReportEntry } from '@/components/screens/bug-report-screen';
import type { NotificationSettings } from '@/components/screens/notification-settings-screen';
import type { OwnedCharacter } from '@/components/screens/sheets/character-picker-sheet';
import { characterIdFromCode } from '@/api/adapters/room';
import type {
  BugReportResponse,
  CharacterAnimations,
  CharacterItem,
  CharacterPoseResponse,
  GoalItem,
  MyCharacterItem,
  NotificationSettingResponse,
} from '@/api/types';

// ---------- Onboarding ----------

/** Server goal master → onboarding survey option (id is the numeric id stringified). */
export function toOnboardingGoal(g: GoalItem, index: number): OnboardingGoal {
  return {
    id: String(g.id ?? index),
    label: g.name ?? g.code ?? '목표',
    code: g.code,
  };
}

// App character ids double as server character codes (bear/otter/sheep/…), so
// mapping is a code match against the /characters master.

/** Server selectedCharacterId → app CharacterId (undefined if the code has no app art). */
export function toAppCharacterId(
  serverId: number,
  masters: CharacterItem[],
): CharacterId | undefined {
  const code = masters.find((m) => m.id === serverId)?.code;
  return CHARACTER_OPTIONS.find((o) => o.id === code)?.id;
}

/** App CharacterId → server character id (undefined if the server has no such code). */
export function toServerCharacterId(
  appId: CharacterId,
  masters: CharacterItem[],
): number | undefined {
  return masters.find((m) => m.code === appId)?.id;
}

/**
 * 캐릭터 프레임 (#735) — 탭 순환 순서대로의 CDN 키 목록. 앱은 프레임을 **이 한
 * 가지 모양으로만** 다룬다: 포즈가 몇 개든, 어느 엔드포인트에서 왔든.
 *
 * 두 출처가 있다. `/characters`·`/me/characters`는 admin에 등록한 `poses[]`를
 * 주고(개수 자유, `sortOrder` 순), 방 렌더 계열(`RenderCharacter`)은 아직
 * 레거시 3칸(`idle`/`poseCycle`/`wave`)만 준다. poses가 있으면 그쪽이 이기고,
 * 없으면 레거시로 떨어진다 — 서버가 렌더 응답에도 poses를 실어주면 이 함수만
 * 남기고 레거시 갈래를 지우면 된다.
 */
export function toCharacterFrames(
  poses?: CharacterPoseResponse[],
  animations?: CharacterAnimations,
): string[] {
  if (poses?.length) {
    return (
      [...poses]
        // sortOrder가 같으면 id로 — 동률에서 순서가 흔들리지 않게.
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0))
        .map((p) => p.assetKey)
        .filter(isCdnKey)
    );
  }
  return [animations?.idle, animations?.poseCycle, animations?.wave].filter(isCdnKey);
}

/**
 * 마스터 /characters → 캐릭터별 프레임 맵 (#589 → #735) — 온보딩 캐러셀의 활성
 * 카드 재생용. 프레임이 없는 캐릭터는 빠진다(번들 정적 포즈로 폴백).
 */
export function toCharacterFramesMap(
  masters: CharacterItem[],
): Partial<Record<CharacterId, string[]>> {
  const map: Partial<Record<CharacterId, string[]>> = {};
  for (const m of masters) {
    const opt = CHARACTER_OPTIONS.find((o) => o.id === m.code);
    const frames = toCharacterFrames(m.poses, m.animations);
    if (opt && frames.length) map[opt.id] = frames;
  }
  return map;
}

/** Bug report → 내 제보 내역 row (#496) — 미지정 상태는 접수됨으로 본다. */
export function toBugReportEntry(b: BugReportResponse): BugReportEntry {
  const d = b.createdAt ? new Date(b.createdAt) : null;
  return {
    id: b.bugReportId ?? 0,
    title: b.title ?? '',
    status: b.status ?? 'RECEIVED',
    date: d ? monthDayLabel(d) : '',
    // 첨부 키 (#736) — 화면이 이걸로 비공개 스크린샷을 따로 받아온다.
    screenshotKeys: b.screenshotKeys ?? [],
  };
}

/**
 * Push 알림 설정 (#495) — 서버가 안 내려준 필드는 서버 기본과 같게 켜짐(true)
 * 으로 본다.
 */
export function toNotificationSettings(res: NotificationSettingResponse): NotificationSettings {
  return { all: res.all ?? true, reminder: res.reminder ?? true, house: res.house ?? true };
}

/**
 * Owned character (GET /me/characters) → picker model. Characters whose code
 * has no local sprite art drop out (the picker model needs an app CharacterId
 * for fallback art and metadata) — null result.
 */
export function toOwnedCharacter(c: MyCharacterItem): OwnedCharacter | null {
  const id = characterIdFromCode(c.code);
  if (!id || c.characterId == null) return null;
  const meta = CHARACTER_OPTIONS.find((o) => o.id === id);
  return {
    serverId: c.characterId,
    id,
    name: c.name || meta?.name || '',
    assetKey: c.baseAssetKey,
    frames: toCharacterFrames(c.poses, c.animations),
    selected: c.selected === true,
  };
}
