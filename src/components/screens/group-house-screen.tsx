import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { CharacterAvatar } from '@/components/character-avatar';
import { type HouseCover, HouseCoverPicker } from '@/components/house-cover-picker';
import { Room } from '@/components/room/room';
import { DateRangeSheet } from '@/components/screens/sheets/date-range-sheet';
import { Icon } from '@/components/ui/icon';
import {
  CrownPictogram,
  DoorPictogram,
  HousePictogram,
  PencilPictogram,
  Pictogram,
  type PictogramName,
  TargetPictogram,
} from '@/components/ui/pictograms';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { useToast } from '@/components/ui/toast';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';
import type { FurnitureItem, Wallpaper } from '@/resources/furniture';
import { assetSource, isCdnKey } from '@/resources/asset';
import { formatDate, todayIso, toIsoDate } from '@/utils/datetime';

/**
 * A member's live room resolved for the tile preview (their placement + worn
 * character). Absent entry = not loaded / fetch failed → plain tile fallback.
 */
export type MemberRoomPreview = {
  placedFurnitureIds: string[];
  wallpaperId?: string;
  floorId?: string | null;
  backgroundId?: string | null;
  characterId?: CharacterId;
};

export type RoomCell = {
  name: string;
  /** Tile background tint (kept from the prototype palette). */
  color: string;
  isMine?: boolean;
  /** This member is the house OWNER (👑 on the tile + 방장 badge). */
  isOwner?: boolean;
  /** API membership id — enables the server kick action when provided. */
  membershipId?: number;
  /** API user id — the friend's room owner id (guestbook, room visit). */
  userId?: number;
};

/** Context handed to onVisitFriend — ids enable server features (방명록, 방/루틴 조회). */
export type VisitedFriend = {
  name: string;
  userId?: number;
  houseId?: number;
  membershipId?: number;
};

export type Floor = { level: string; rooms: RoomCell[] };

export type House = {
  title: string;
  /** May be absent for non-owners (the API hides the code from members). */
  inviteCode?: string;
  floors: Floor[];
  /** API house id — enables server actions (kick/leave) when provided. */
  houseId?: number;
  myRole?: 'OWNER' | 'MEMBER';
  /** House growth level (히어로 레벨 pill; missions raise it). */
  level?: number;
  /** Accumulated growth points — 레벨 진행도(100pt/레벨) 표시용. */
  growthPoints?: number;
  /** Group missions shown in the "우리 그룹의 미션" card. */
  missions?: HouseMission[];
  /** House intro + capacity — prefill for the owner's edit form. */
  description?: string;
  maxMembers?: number;
  memberCount?: number;
  /** Current cover art key — prefill for the owner's edit form. */
  coverImageKey?: string;
};

/** Owner's house-settings edit (PUT /houses/{id}; omitted fields are kept). */
export type HouseEditInput = {
  name: string;
  description?: string;
  maxMembers?: number;
  /** Cover from GET /houses/cover-images; omitted = keep the current one. */
  coverImageKey?: string;
};

/** Capacity choices for the edit form (server allows 1~10). */
const CAPACITY_OPTIONS = [2, 3, 4, 6, 8, 10];

/** Group mission (server house mission) shown in the missions card. */
export type HouseMission = {
  id: number;
  title: string;
  /** Mission-type description shown under the progress bar. */
  desc: string;
  icon: PictogramName;
  current: number;
  target: number;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  /** Target reached — the reward is claimable while ACTIVE. */
  achieved?: boolean;
  /** Mission end date (device-local "YYYY-MM-DD"); absent = 무기한. */
  endsOn?: string;
};

/** Creatable mission types (STREAK_DAYS is not supported by the server yet). */
export type NewHouseMission = {
  title: string;
  missionType: 'DAILY_MEMBER_RATE' | 'WEEKLY_MEMBER_COUNT';
  targetValue: number;
  /** Optional period (ISO date-time, KST); omitted = 즉시 시작·무기한. */
  startsAt?: string;
  endsAt?: string;
};

/** "YYYY-MM-DD" + n days → "YYYY-MM-DD" (device-local; noon avoids DST edges). */
function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

const MISSION_TYPE_OPTIONS: {
  type: NewHouseMission['missionType'];
  icon: PictogramName;
  label: string;
}[] = [
  { type: 'DAILY_MEMBER_RATE', icon: 'sun', label: '일일 달성률' },
  { type: 'WEEKLY_MEMBER_COUNT', icon: 'calendar', label: '주간 달성 횟수' },
];

const DEMO_MISSIONS: HouseMission[] = [
  { id: 1, title: '이번 주 다같이 루틴 지키기', desc: '주간 구성원 달성 횟수', icon: 'calendar', current: 12, target: 20, status: 'ACTIVE' }, // prettier-ignore
  { id: 2, title: '아침 기상 인증 모으기', desc: '일일 구성원 달성률', icon: 'sun', current: 8, target: 8, status: 'ACTIVE', achieved: true }, // prettier-ignore
  { id: 3, title: '지난주 스트레칭 미션', desc: '주간 구성원 달성 횟수', icon: 'calendar', current: 20, target: 20, status: 'COMPLETED' }, // prettier-ignore
];

const DEFAULT_HOUSES: House[] = [
  {
    title: '소마파이팅',
    inviteCode: 'SOMA-2143',
    level: 3,
    missions: DEMO_MISSIONS,
    floors: [
      {
        level: '2층',
        rooms: [
          { name: '최준서', color: '#F5E1D8', isOwner: true },
          { name: '장진형', color: '#D9E8D4' },
        ],
      },
      {
        level: '1층',
        rooms: [
          { name: '임채영', color: '#F5E8C8' },
          { name: '나의 방', color: '#E8E0D0', isMine: true },
        ],
      },
    ],
  },
  {
    title: '소마 2번째 집',
    inviteCode: 'SOMA-7788',
    level: 1,
    missions: DEMO_MISSIONS.slice(0, 1),
    floors: [
      {
        level: '2층',
        rooms: [
          { name: '김도현', color: '#E4DCF0', isOwner: true },
          { name: '박서연', color: '#FBE0D8' },
        ],
      },
      {
        level: '1층',
        rooms: [
          { name: '이지우', color: '#D8E8F0' },
          { name: '나의 방', color: '#E8E0D0', isMine: true },
        ],
      },
    ],
  },
];

export type GroupHouseScreenProps = {
  houses?: House[];
  /** True while my houses are loading from the API. */
  loading?: boolean;
  characterId?: CharacterId;
  /**
   * Controlled house-switcher index. The screen unmounts while visiting a
   * friend's room, so the shell keeps this to restore the house being viewed
   * (#241). Omit for internal state (dev gallery).
   */
  houseIndex?: number;
  onHouseIndexChange?: (index: number) => void;
  onVisitFriend?: (friend: VisitedFriend) => void;
  onVisitMyRoom?: () => void;
  onOpenSearch?: () => void;
  /** Kick a member via the API (owner only); shown when the house has ids. */
  onKickMember?: (houseId: number, membershipId: number) => void;
  /** Leave the current house via the API. */
  onLeaveHouse?: (houseId: number) => void;
  /** File a mission as a daily routine under the house-named category. */
  onAddMissionRoutine?: (houseId: number, mission: HouseMission) => void;
  /** My routines in this house's category — 연동/기여함 라벨 판정. */
  linkedRoutines?: { title: string; completedToday?: boolean }[];
  /** Mission ids contributed this session (기여 직후 즉시 반영용 보조 신호). */
  contributedMissionIds?: number[];
  /** Claim the reward of an achieved mission. */
  onClaimMission?: (houseId: number, missionId: number) => void;
  /** Create a new group mission. */
  onCreateMission?: (houseId: number, input: NewHouseMission) => void;
  /** Edit the house settings via the API (owner only). */
  onUpdateHouse?: (houseId: number, input: HouseEditInput) => void;
  /** Cover catalog (GET /houses/cover-images); empty hides the edit section. */
  covers?: HouseCover[];
  /** Live room previews by membershipId — tiles render the member's actual room. */
  roomPreviews?: Record<number, MemberRoomPreview>;
  // Catalogue the previews resolve against (server shop items; local defaults otherwise).
  furniture?: FurnitureItem[];
  wallpapers?: Wallpaper[];
  floors?: Wallpaper[];
  backgrounds?: Wallpaper[];
  /** Hand the OWNER role to a member via the API (owner only). */
  onTransferOwnership?: (houseId: number, membershipId: number) => void;
  /** Reissue the invite code via the API (owner only; the old code expires). */
  onReissueInviteCode?: (houseId: number) => void;
};

/**
 * Group house screen, ported from the prototype `GroupHouseScreen`: a house
 * switcher, the members' rooms (tap to visit), a group-goals card, and a member
 * management sub-view with an invite code and kick flow. The prototype's
 * absolutely-positioned windows over a house PNG are adapted to a token-based
 * floor/room grid. Spec domain: rougether-spec domains/house.
 */
export function GroupHouseScreen({
  houses = DEFAULT_HOUSES,
  loading = false,
  characterId = DEFAULT_CHARACTER_ID,
  houseIndex: houseIndexProp,
  onHouseIndexChange,
  onVisitFriend,
  onVisitMyRoom,
  onOpenSearch,
  onKickMember,
  onLeaveHouse,
  onAddMissionRoutine,
  linkedRoutines = [],
  contributedMissionIds = [],
  onClaimMission,
  onCreateMission,
  onUpdateHouse,
  covers = [],
  roomPreviews,
  furniture,
  wallpapers,
  floors: floorSurfaces,
  backgrounds,
  onTransferOwnership,
  onReissueInviteCode,
}: GroupHouseScreenProps) {
  const t = useTokens();
  const { show: toast } = useToast();
  const headerInset = useHeaderInsetStyle();
  const screenStyle = useScreenStyle([]);

  const [internalHouseIndex, setInternalHouseIndex] = useState(0);
  const houseIndex = houseIndexProp ?? internalHouseIndex;
  const setHouseIndex = (next: number) => {
    setInternalHouseIndex(next);
    onHouseIndexChange?.(next);
  };
  const [showMembers, setShowMembers] = useState(false);
  const [kicked, setKicked] = useState<string[]>([]);
  const [memberToKick, setMemberToKick] = useState<RoomCell | null>(null);
  const [showCreateMission, setShowCreateMission] = useState(false);
  const [missionTitle, setMissionTitle] = useState('');
  const [missionType, setMissionType] =
    useState<NewHouseMission['missionType']>('WEEKLY_MEMBER_COUNT');
  const [missionTarget, setMissionTarget] = useState('10');
  // Optional mission period (기간 설정 토글) — off sends nothing (즉시 시작·무기한).
  const [missionHasPeriod, setMissionHasPeriod] = useState(false);
  const [missionStart, setMissionStart] = useState(todayIso());
  const [missionEnd, setMissionEnd] = useState<string | undefined>(undefined);
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  // 미션 → 내 루틴 추가 확인 모달의 대상.
  const [missionToAdd, setMissionToAdd] = useState<HouseMission | null>(null);
  const [showEditHouse, setShowEditHouse] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMax, setEditMax] = useState<number | undefined>(undefined);
  const [editCover, setEditCover] = useState<string | undefined>(undefined);
  const [transferTarget, setTransferTarget] = useState<RoomCell | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showReissueConfirm, setShowReissueConfirm] = useState(false);

  const currentHouse: House | undefined = houses[Math.min(houseIndex, houses.length - 1)];
  const members = useMemo(
    () =>
      (currentHouse?.floors ?? []).flatMap((f) => f.rooms.map((r) => ({ ...r, level: f.level }))),
    [currentHouse],
  );
  const keyFor = (name: string) => `${houseIndex}-${name}`;
  const isKicked = (name: string) => kicked.includes(keyFor(name));

  const prevHouse = () => setHouseIndex((houseIndex - 1 + houses.length) % houses.length);
  const nextHouse = () => setHouseIndex((houseIndex + 1) % houses.length);

  const missions = currentHouse?.missions ?? [];
  const activeMissions = missions.filter((m) => m.status === 'ACTIVE');
  /** 오늘 기여 완료 판정 — 세션 추적 또는 연동 루틴의 오늘 완료에서 파생. */
  const isContributed = (mission: HouseMission) =>
    contributedMissionIds.includes(mission.id) ||
    linkedRoutines.some((r) => r.title === mission.title && r.completedToday);
  const contributedToday = activeMissions.filter(isContributed).length;
  const toNextLevel =
    currentHouse?.growthPoints != null ? 100 - (currentHouse.growthPoints % 100) : undefined;
  // 층 구분 없이 한 그리드로 — 2개씩 끊어 행을 만든다 (내 방은 정렬상 마지막).
  const roomPairs: RoomCell[][] = [];
  const flatRooms = (currentHouse?.floors ?? []).flatMap((f) => f.rooms);
  for (let i = 0; i < flatRooms.length; i += 2) roomPairs.push(flatRooms.slice(i, i + 2));
  // Owner tools need the OWNER role and a server house id.
  const isOwner = currentHouse?.myRole === 'OWNER' && !!currentHouse?.houseId;
  // Kick is server-side owner-only too; the demo (no houseId) keeps the local
  // placeholder flow so the gallery preview stays interactive.
  const canKick = isOwner || !currentHouse?.houseId;
  // Mission creation is owner-only on the server (403 HOUSE_NOT_OWNER).
  const canCreateMission = !!(onCreateMission && isOwner);
  const missionTargetNum = Number(missionTarget);
  const canSubmitMission =
    missionTitle.trim().length > 0 &&
    Number.isInteger(missionTargetNum) &&
    missionTargetNum >= 1 &&
    missionTargetNum <= 1000;
  const submitMission = () => {
    // Blocked taps explain themselves, first unmet condition first.
    if (missionTitle.trim().length === 0) return toast('미션 이름을 입력해주세요', 'error');
    if (!Number.isInteger(missionTargetNum) || missionTargetNum < 1 || missionTargetNum > 1000)
      return toast('목표값은 1~1000 사이 숫자로 입력해주세요', 'error');
    if (!currentHouse?.houseId) return;
    onCreateMission?.(currentHouse.houseId, {
      title: missionTitle.trim(),
      missionType,
      targetValue: missionTargetNum,
      // KST day bounds: 시작일 자정부터 종료일 하루 끝까지 (종료일 당일 포함).
      ...(missionHasPeriod
        ? {
            startsAt: `${missionStart}T00:00:00+09:00`,
            endsAt: missionEnd ? `${missionEnd}T23:59:59+09:00` : undefined,
          }
        : {}),
    });
    setShowCreateMission(false);
    setMissionTitle('');
    setMissionTarget('10');
    setMissionHasPeriod(false);
  };
  const toggleMissionPeriod = () => {
    setMissionHasPeriod((prev) => {
      const next = !prev;
      if (next) {
        // Re-derive on each enable — the mounted default goes stale overnight.
        const start = todayIso();
        setMissionStart(start);
        setMissionEnd(addDaysIso(start, 7));
      }
      return next;
    });
  };
  const openEditHouse = () => {
    setEditName(currentHouse?.title ?? '');
    setEditDesc(currentHouse?.description ?? '');
    setEditMax(currentHouse?.maxMembers);
    setEditCover(currentHouse?.coverImageKey);
    setShowEditHouse(true);
  };
  const editNameValid = editName.trim().length >= 2 && editName.trim().length <= 30;
  const submitEditHouse = () => {
    if (!editNameValid) return toast('집 이름은 2~30자로 입력해주세요', 'error');
    if (!currentHouse?.houseId) return;
    onUpdateHouse?.(currentHouse.houseId, {
      name: editName.trim(),
      description: editDesc.trim() || undefined,
      maxMembers: editMax,
      // Omitted keeps the server value — only send an actual pick.
      coverImageKey: editCover,
    });
    setShowEditHouse(false);
  };
  const confirmTransfer = () => {
    if (transferTarget?.membershipId && currentHouse?.houseId) {
      onTransferOwnership?.(currentHouse.houseId, transferTarget.membershipId);
    }
    setTransferTarget(null);
  };
  // Leaving needs the server house id; the server rejects an OWNER's leave
  // until ownership is transferred, so the owner sees guidance instead.
  const canLeave = !!(onLeaveHouse && currentHouse?.houseId);
  const confirmLeave = () => {
    if (currentHouse?.houseId) onLeaveHouse?.(currentHouse.houseId);
    setShowLeaveConfirm(false);
    setShowMembers(false);
  };
  const confirmKick = () => {
    if (memberToKick) {
      // Server kick when wired to the API; local placeholder otherwise (demo).
      if (onKickMember && currentHouse?.houseId && memberToKick.membershipId) {
        onKickMember(currentHouse.houseId, memberToKick.membershipId);
      } else {
        setKicked((prev) => [...prev, keyFor(memberToKick.name)]);
      }
    }
    setMemberToKick(null);
  };

  // No houses yet (fresh account) → guide to 집 탐색 instead of crashing on
  // an empty switcher.
  if (!currentHouse) {
    return (
      <View style={[styles.screen, screenStyle]}>
        <View style={styles.emptyWrap}>
          {loading ? (
            <>
              <ActivityIndicator color={t.primary} />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>불러오는 중…</Text>
            </>
          ) : (
            <>
              <Text style={[Typography.h3, { color: t.text }]}>아직 함께하는 집이 없어요</Text>
              <Text style={[Typography.body, styles.emptyBody, { color: t.textMuted }]}>
                집을 만들거나 초대코드로 입주해 친구들과 루틴을 함께 키워보세요.
              </Text>
              <Pressable
                onPress={onOpenSearch}
                accessibilityRole="button"
                accessibilityLabel="집 탐색"
                style={[styles.emptyCta, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>집 탐색하기</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }

  if (showMembers) {
    return (
      <View style={[styles.screen, screenStyle]}>
        <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
          <Pressable
            onPress={() => setShowMembers(false)}
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
            style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="back" size={26} color={t.text} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={[Typography.supporting, { color: t.primaryText }]}>
              {currentHouse.title}
            </Text>
            <Text style={[Typography.h3, { color: t.text }]}>구성원 관리</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {currentHouse.inviteCode ? (
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={styles.codeHead}>
                <Text style={[Typography.label, styles.flex, { color: t.text }]}>초대코드</Text>
                {isOwner && onReissueInviteCode ? (
                  <Pressable
                    onPress={() => setShowReissueConfirm(true)}
                    accessibilityRole="button"
                    accessibilityLabel="초대코드 재발급"
                    style={[styles.reissueBtn, { backgroundColor: t.surfaceMuted }]}>
                    <Text style={[Typography.supporting, { color: t.primaryText }]}>재발급</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                친구에게 코드를 공유해 집에 초대하세요.
              </Text>
              <View
                style={[
                  styles.codeBox,
                  { borderColor: t.border, backgroundColor: t.surfaceMuted },
                ]}>
                <Text style={[Typography.h3, styles.code, { color: t.text }]}>
                  {currentHouse.inviteCode}
                </Text>
              </View>
            </View>
          ) : null}

          {isOwner && onUpdateHouse ? (
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[Typography.label, { color: t.text }]}>집 정보</Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                집 이름·소개·정원을 바꿀 수 있어요. (방장 전용)
              </Text>
              <Pressable
                onPress={openEditHouse}
                accessibilityRole="button"
                accessibilityLabel="집 정보 수정"
                style={[styles.editHouseBtn, { backgroundColor: t.surfaceMuted }]}>
                <PencilPictogram size={14} />
                <Text style={[Typography.label, { color: t.primaryText }]}>집 정보 수정</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.memberList}>
            {members.map((member) => {
              const kickedOut = isKicked(member.name);
              return (
                <View
                  key={`${member.level}-${member.name}`}
                  style={[styles.memberRow, { backgroundColor: t.surface }]}>
                  <View
                    style={[
                      styles.memberAvatar,
                      { backgroundColor: kickedOut ? t.surfaceMuted : member.color },
                    ]}>
                    {kickedOut ? (
                      <Icon name="leave" size={22} color={t.textMuted} />
                    ) : (
                      <CharacterAvatar characterId={characterId} size={36} />
                    )}
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.memberNameRow}>
                      <Text style={[Typography.label, { color: t.text }]}>{member.name}</Text>
                      {member.isOwner ? (
                        <View style={[styles.ownerBadge, { backgroundColor: `${t.primary}22` }]}>
                          <CrownPictogram size={10} />
                          <Text style={[styles.ownerBadgeText, { color: t.primaryText }]}>
                            방장
                          </Text>
                        </View>
                      ) : null}
                      {member.isMine ? (
                        <Text
                          style={[styles.myBadge, { backgroundColor: t.warning, color: t.onTint }]}>
                          MY
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>
                      {kickedOut ? '강퇴된 멤버' : member.level}
                    </Text>
                  </View>
                  {isOwner &&
                  onTransferOwnership &&
                  !member.isMine &&
                  member.membershipId &&
                  !kickedOut ? (
                    <Pressable
                      onPress={() => setTransferTarget(member)}
                      accessibilityRole="button"
                      accessibilityLabel={`${member.name} 방장 위임`}
                      style={[styles.kickBtn, { backgroundColor: `${t.primary}22` }]}>
                      <Text style={[Typography.supporting, { color: t.primaryText }]}>위임</Text>
                    </Pressable>
                  ) : null}
                  {/* 내 카드에는 강퇴 버튼 자체를 두지 않는다 (disable 아님). */}
                  {canKick && !member.isMine ? (
                    <Pressable
                      onPress={() => setMemberToKick(member)}
                      disabled={kickedOut}
                      accessibilityRole="button"
                      accessibilityLabel={`${member.name} 강퇴`}
                      style={[
                        styles.kickBtn,
                        { backgroundColor: kickedOut ? t.surfaceMuted : `${t.danger}22` },
                      ]}>
                      <Text
                        style={[
                          Typography.supporting,
                          { color: kickedOut ? t.textDisabled : t.danger },
                        ]}>
                        {kickedOut ? '강퇴됨' : '강퇴'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>

          {canLeave ? (
            <View style={styles.leaveWrap}>
              {isOwner ? (
                <Text style={[Typography.supporting, styles.leaveHint, { color: t.textMuted }]}>
                  방장은 다른 멤버에게 방장을 위임한 뒤 나갈 수 있어요.
                </Text>
              ) : (
                <Pressable
                  onPress={() => setShowLeaveConfirm(true)}
                  accessibilityRole="button"
                  accessibilityLabel="집 나가기"
                  style={[styles.leaveBtn, { backgroundColor: `${t.danger}22` }]}>
                  <DoorPictogram size={14} />
                  <Text style={[Typography.label, { color: t.danger }]}>집 나가기</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </ScrollView>

        {showReissueConfirm ? (
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: t.surface }]}>
              <Text style={[Typography.h3, { color: t.text }]}>초대코드를 재발급할까요?</Text>
              <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
                기존 코드는 즉시 만료돼요. 이미 공유한 코드로는 더 이상 입주할 수 없어요.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setShowReissueConfirm(false)}
                  accessibilityRole="button"
                  accessibilityLabel="재발급 취소"
                  style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.label, { color: t.text }]}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (currentHouse.houseId) onReissueInviteCode?.(currentHouse.houseId);
                    setShowReissueConfirm(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="재발급 확인"
                  style={[styles.modalBtn, { backgroundColor: t.primary }]}>
                  <Text style={[Typography.label, { color: t.onPrimary }]}>재발급</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {showLeaveConfirm ? (
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: t.surface }]}>
              <Text style={[Typography.h3, { color: t.text }]}>집에서 나갈까요?</Text>
              <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
                나가면 이 집에 다시 참여할 수 없어요. 기여 기록은 유지됩니다.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setShowLeaveConfirm(false)}
                  accessibilityRole="button"
                  accessibilityLabel="나가기 취소"
                  style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.label, { color: t.text }]}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={confirmLeave}
                  accessibilityRole="button"
                  accessibilityLabel="나가기 확인"
                  style={[styles.modalBtn, { backgroundColor: t.danger }]}>
                  <Text style={[Typography.label, { color: t.onPrimary }]}>나가기</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {memberToKick ? (
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: t.surface }]}>
              <Text style={[Typography.h3, { color: t.text }]}>정말 강퇴할까요?</Text>
              <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
                {memberToKick.name}님을 강퇴하면 집 화면에서 빈방으로 표시됩니다.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setMemberToKick(null)}
                  accessibilityRole="button"
                  accessibilityLabel="취소"
                  style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.label, { color: t.text }]}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={confirmKick}
                  accessibilityRole="button"
                  accessibilityLabel="강퇴 확인"
                  style={[styles.modalBtn, { backgroundColor: t.danger }]}>
                  <Text style={[Typography.label, { color: t.onPrimary }]}>강퇴</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {transferTarget ? (
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: t.surface }]}>
              <Text style={[Typography.h3, { color: t.text }]}>방장을 위임할까요?</Text>
              <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
                {transferTarget.name}님에게 방장을 넘기면 집 관리 권한(정보 수정·강퇴·초대코드)이
                이동하고 되돌릴 수 없어요.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setTransferTarget(null)}
                  accessibilityRole="button"
                  accessibilityLabel="위임 취소"
                  style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.label, { color: t.text }]}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={confirmTransfer}
                  accessibilityRole="button"
                  accessibilityLabel="위임 확인"
                  style={[styles.modalBtn, { backgroundColor: t.primary }]}>
                  <Text style={[Typography.label, { color: t.onPrimary }]}>위임</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {showEditHouse ? (
          <View style={styles.modalOverlay}>
            <View style={[styles.modal, { backgroundColor: t.surface }]}>
              <Text style={[Typography.h3, { color: t.text }]}>집 정보 수정</Text>
              <ScrollView style={styles.editScroll} contentContainerStyle={styles.missionForm}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  집 이름 (2~30자)
                </Text>
                <TextInput
                  value={editName}
                  onChangeText={(v) => setEditName(v.slice(0, 30))}
                  accessibilityLabel="집 이름"
                  placeholder="집 이름"
                  placeholderTextColor={t.textMuted}
                  style={[styles.missionInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
                />
                <Text style={[Typography.supporting, { color: t.textMuted }]}>한 줄 소개</Text>
                <TextInput
                  value={editDesc}
                  onChangeText={setEditDesc}
                  accessibilityLabel="집 소개"
                  placeholder="어떤 루틴을 함께 하나요?"
                  placeholderTextColor={t.textMuted}
                  style={[styles.missionInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
                />
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  정원{currentHouse.memberCount ? ` (현재 ${currentHouse.memberCount}명)` : ''}
                </Text>
                <View style={styles.missionTypeRow}>
                  {CAPACITY_OPTIONS.map((n) => {
                    const selected = n === editMax;
                    // The server rejects a capacity below the current headcount.
                    const tooSmall = !!currentHouse.memberCount && n < currentHouse.memberCount;
                    return (
                      <Pressable
                        key={n}
                        onPress={() =>
                          tooSmall
                            ? toast('현재 인원보다 작게 줄일 수 없어요', 'error')
                            : setEditMax(n)
                        }
                        accessibilityRole="radio"
                        accessibilityState={{ selected, disabled: tooSmall }}
                        accessibilityLabel={`정원 ${n}명`}
                        style={[
                          styles.capacityBtn,
                          {
                            backgroundColor: selected
                              ? t.primary
                              : tooSmall
                                ? t.disabledBg
                                : t.surfaceMuted,
                          },
                        ]}>
                        <Text
                          style={[
                            Typography.supporting,
                            {
                              color: selected
                                ? t.onPrimary
                                : tooSmall
                                  ? t.textDisabled
                                  : t.textMuted,
                            },
                          ]}>
                          {n}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {covers.length > 0 ? (
                  <>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>대표 이미지</Text>
                    <HouseCoverPicker
                      covers={covers}
                      selectedKey={editCover}
                      onSelect={setEditCover}
                    />
                  </>
                ) : null}
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setShowEditHouse(false)}
                  accessibilityRole="button"
                  accessibilityLabel="집 정보 수정 취소"
                  style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.label, { color: t.text }]}>취소</Text>
                </Pressable>
                <Pressable
                  onPress={submitEditHouse}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !editNameValid }}
                  accessibilityLabel="집 정보 저장"
                  style={[
                    styles.modalBtn,
                    { backgroundColor: editNameValid ? t.primary : t.disabledBg },
                  ]}>
                  <Text
                    style={[
                      Typography.label,
                      { color: editNameValid ? t.onPrimary : t.textMuted },
                    ]}>
                    저장
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.screen, screenStyle]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <View style={styles.flex} />
        <Pressable
          onPress={onOpenSearch}
          accessibilityRole="button"
          accessibilityLabel="집 탐색"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="search" size={18} color={t.text} />
        </Pressable>
        <Pressable
          onPress={() => setShowMembers(true)}
          accessibilityRole="button"
          accessibilityLabel="구성원 목록"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="members" size={18} color={t.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* 커버 히어로 — #261의 대표 이미지를 집 화면이 사용한다 (B안). */}
        <View style={styles.hero}>
          {isCdnKey(currentHouse.coverImageKey) ? (
            <Image
              source={assetSource(currentHouse.coverImageKey)}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={120}
              accessibilityLabel={`${currentHouse.title} 대표 이미지`}
              testID="house-hero-cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: t.surfaceMuted }]} />
          )}
          {/* 고정 밝기 스크림 위 텍스트 — 테마와 무관한 커버 위라 literal 사용. */}
          <View style={[styles.heroPill, { backgroundColor: 'rgba(255,255,255,0.88)' }]}>
            <HousePictogram size={12} />
            <Text style={[Typography.supporting, styles.heroPillText]}>
              Lv.{currentHouse.level ?? 0}
              {currentHouse.growthPoints != null ? ` · ${currentHouse.growthPoints % 100}/100` : ''}
            </Text>
          </View>
          {houses.length > 1 ? (
            <>
              <Pressable
                onPress={prevHouse}
                accessibilityRole="button"
                accessibilityLabel="이전 집"
                hitSlop={8}
                style={[styles.heroNav, styles.heroNavLeft]}>
                <Icon name="back" size={16} color="#4A403A" />
              </Pressable>
              <Pressable
                onPress={nextHouse}
                accessibilityRole="button"
                accessibilityLabel="다음 집"
                hitSlop={8}
                style={[styles.heroNav, styles.heroNavRight]}>
                <Icon name="forward" size={16} color="#4A403A" />
              </Pressable>
            </>
          ) : null}
          <View style={styles.heroFoot}>
            <Text style={[Typography.h3, styles.heroName]}>{currentHouse.title}</Text>
            <Text style={[Typography.supporting, styles.heroMeta]}>
              멤버 {currentHouse.memberCount ?? flatRooms.length}
              {currentHouse.maxMembers ? ` / ${currentHouse.maxMembers}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.dots}>
          {houses.map((house, i) => (
            <View
              // houseId when wired; titles can repeat, so fall back to index.
              key={house.houseId ?? `demo-${i}`}
              style={[
                styles.dot,
                i === houseIndex
                  ? { width: 20, backgroundColor: t.primary }
                  : { width: 6, backgroundColor: t.border },
              ]}
            />
          ))}
        </View>

        {/* 요약 스탯 — 스크롤 없이 집의 오늘이 보인다 (B안). */}
        <View style={styles.summaryRow}>
          <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.statV, { color: t.primaryText }]}>{activeMissions.length}</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>진행 중 미션</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.statV, { color: t.primaryText }]}>
              {contributedToday}/{activeMissions.length}
            </Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>오늘 나의 기여</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.statV, { color: t.primaryText }]}>{toNextLevel ?? '—'}</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>다음 레벨까지</Text>
          </View>
        </View>

        <View style={styles.floors}>
          {roomPairs.map((pair, pairIdx) => (
            <View key={pair[0]?.name ?? pairIdx} style={styles.floor}>
              <View style={styles.floorRooms}>
                {pair.map((room) => {
                  const empty = isKicked(room.name);
                  const preview =
                    !empty && room.membershipId != null
                      ? roomPreviews?.[room.membershipId]
                      : undefined;
                  return (
                    <Pressable
                      key={room.name}
                      onPress={() =>
                        empty
                          ? undefined
                          : room.isMine
                            ? onVisitMyRoom?.()
                            : onVisitFriend?.({
                                name: room.name,
                                userId: room.userId,
                                houseId: currentHouse.houseId,
                                membershipId: room.membershipId,
                              })
                      }
                      disabled={empty}
                      accessibilityRole="button"
                      accessibilityLabel={room.isMine ? `${room.name} (나)` : room.name}
                      style={[
                        styles.roomCell,
                        {
                          backgroundColor: empty ? t.surfaceMuted : room.color,
                          borderColor: t.border,
                        },
                      ]}>
                      {/* The member's live room fills the tile (visit preview);
                          plain tint + avatar stand in until it loads. */}
                      {preview ? (
                        <View style={styles.roomPreview} pointerEvents="none" testID="room-preview">
                          <Room
                            placedFurnitureIds={preview.placedFurnitureIds}
                            wallpaperId={preview.wallpaperId}
                            floorId={preview.floorId}
                            backgroundId={preview.backgroundId}
                            characterId={preview.characterId}
                            furniture={furniture}
                            wallpapers={wallpapers}
                            floors={floorSurfaces}
                            backgrounds={backgrounds}
                            style={styles.roomPreviewFill}
                          />
                        </View>
                      ) : null}
                      {room.isMine ? (
                        <View style={[styles.myTag, { backgroundColor: t.warning }]}>
                          <Text style={[styles.myTagText, { color: t.onTint }]}>MY</Text>
                        </View>
                      ) : null}
                      {empty ? (
                        <Icon name="leave" size={36} color={t.textMuted} />
                      ) : preview ? null : (
                        <CharacterAvatar characterId={characterId} size={64} />
                      )}
                      {/* Tiles keep their fixed pastel bg in dark mode — the
                          name needs onTint ink, not the (light) theme text.
                          Over a preview it drops to a bottom scrim for contrast. */}
                      <View style={[styles.roomNameRow, preview && styles.roomNameOverlay]}>
                        {!empty && room.isOwner ? <CrownPictogram size={12} /> : null}
                        <Text
                          style={[
                            Typography.supporting,
                            styles.roomName,
                            { color: empty ? t.textMuted : preview ? '#FFFFFF' : t.onTint },
                          ]}>
                          {empty ? '빈방' : room.isMine ? `${room.name} (나)` : room.name}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.missionHead}>
            <View style={[styles.flex, styles.missionTitleRow]}>
              <TargetPictogram size={18} />
              <Text style={[Typography.h3, { color: t.text }]}>우리 그룹의 미션</Text>
            </View>
            {canCreateMission ? (
              <Pressable
                onPress={() => setShowCreateMission(true)}
                accessibilityRole="button"
                accessibilityLabel="미션 만들기"
                style={[styles.missionAddBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.supporting, { color: t.primaryText }]}>＋ 만들기</Text>
              </Pressable>
            ) : null}
          </View>
          {missions.length === 0 ? (
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              아직 미션이 없어요. 첫 미션을 만들어 다 같이 도전해보세요!
            </Text>
          ) : (
            <View style={styles.goals}>
              {missions.map((mission) => {
                const pct = Math.min(1, mission.current / mission.target);
                const claimable = mission.status === 'ACTIVE' && mission.achieved;
                return (
                  <View
                    key={mission.id}
                    style={[styles.goalRow, { backgroundColor: t.surfaceMuted }]}>
                    <Pictogram name={mission.icon} size={22} />
                    <View style={styles.flex}>
                      <View style={styles.goalHead}>
                        <Text
                          style={[Typography.label, styles.flex, { color: t.text }]}
                          numberOfLines={1}>
                          {mission.title}
                        </Text>
                        <Text style={[Typography.supporting, { color: t.primaryText }]}>
                          {mission.current}/{mission.target}
                        </Text>
                      </View>
                      <View style={[styles.goalTrack, { backgroundColor: t.border }]}>
                        <View
                          style={[
                            styles.goalFill,
                            { backgroundColor: t.primary, width: `${pct * 100}%` },
                          ]}
                        />
                      </View>
                      <View style={styles.missionFoot}>
                        <Text
                          style={[Typography.supporting, styles.flex, { color: t.textMuted }]}
                          numberOfLines={1}>
                          {mission.desc}
                        </Text>
                        {/* Own node (not a desc suffix) so the long type label
                            truncates instead of the date. */}
                        {mission.endsOn && mission.status === 'ACTIVE' ? (
                          <Text style={[Typography.supporting, { color: t.textMuted }]}>
                            ~{mission.endsOn.slice(5).replace('-', '.')}
                          </Text>
                        ) : null}
                        {mission.status === 'COMPLETED' ? (
                          <Text style={[Typography.supporting, { color: t.textMuted }]}>완료</Text>
                        ) : mission.status === 'EXPIRED' ? (
                          <Text style={[Typography.supporting, { color: t.textDisabled }]}>
                            기간 만료
                          </Text>
                        ) : claimable && currentHouse.houseId && onClaimMission ? (
                          <Pressable
                            onPress={() => onClaimMission(currentHouse.houseId!, mission.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`${mission.title} 보상 받기`}
                            style={[styles.missionBtn, { backgroundColor: t.warning }]}>
                            <Text style={[Typography.supporting, { color: t.text }]}>
                              보상 받기
                            </Text>
                          </Pressable>
                        ) : mission.status === 'ACTIVE' && isContributed(mission) ? (
                          // 오늘 기여 완료 — 연동 루틴의 오늘 완료 여부로도 파생되어
                          // 앱을 다시 켜도 라벨이 유지된다.
                          <Text style={[Typography.supporting, { color: t.primaryText }]}>
                            기여함
                          </Text>
                        ) : mission.status === 'ACTIVE' &&
                          linkedRoutines.some((r) => r.title === mission.title) ? (
                          // Filed as my routine — completing it contributes.
                          <Text style={[Typography.supporting, { color: t.textMuted }]}>
                            루틴 연동됨
                          </Text>
                        ) : mission.status === 'ACTIVE' &&
                          currentHouse.houseId &&
                          onAddMissionRoutine ? (
                          <Pressable
                            onPress={() => setMissionToAdd(mission)}
                            accessibilityRole="button"
                            accessibilityLabel={`${mission.title} 내 루틴에 추가`}
                            style={[styles.missionBtn, { backgroundColor: t.primary }]}>
                            <Text style={[Typography.supporting, { color: t.onPrimary }]}>
                              ＋ 내 루틴에
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {missionToAdd && currentHouse?.houseId ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <Text style={[Typography.h3, { color: t.text }]}>내 루틴에 추가하시겠습니까?</Text>
            <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
              {`'${currentHouse.title}' 카테고리에 '${missionToAdd.title}' 루틴이 만들어져요. 루틴을 완료하면 자동으로 미션에 기여돼요.`}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setMissionToAdd(null)}
                accessibilityRole="button"
                accessibilityLabel="루틴 추가 취소"
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>아니요</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onAddMissionRoutine?.(currentHouse.houseId!, missionToAdd);
                  setMissionToAdd(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="루틴 추가 확인"
                style={[styles.modalBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>네</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showCreateMission ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <Text style={[Typography.h3, { color: t.text }]}>새 미션 만들기</Text>
            <View style={styles.missionForm}>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>미션 제목</Text>
              <TextInput
                value={missionTitle}
                onChangeText={(v) => setMissionTitle(v.slice(0, 160))}
                placeholder="예) 이번 주 다같이 루틴 지키기"
                placeholderTextColor={t.textMuted}
                accessibilityLabel="미션 제목"
                style={[styles.missionInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
              />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>미션 유형</Text>
              <View style={styles.missionTypeRow}>
                {MISSION_TYPE_OPTIONS.map((opt) => {
                  const selected = opt.type === missionType;
                  return (
                    <Pressable
                      key={opt.type}
                      onPress={() => setMissionType(opt.type)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[
                        styles.missionTypeBtn,
                        { backgroundColor: selected ? t.primary : t.surfaceMuted },
                      ]}>
                      <Pictogram
                        name={opt.icon}
                        size={14}
                        color={selected ? t.onPrimary : t.textMuted}
                      />
                      <Text
                        style={[
                          Typography.supporting,
                          { color: selected ? t.onPrimary : t.textMuted },
                        ]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                목표 수치 (1~1000)
              </Text>
              <TextInput
                value={missionTarget}
                onChangeText={setMissionTarget}
                keyboardType="number-pad"
                accessibilityLabel="목표 수치"
                style={[styles.missionInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
              />
              <View style={styles.periodRow}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>기간 설정</Text>
                <ToggleSwitch
                  value={missionHasPeriod}
                  onToggle={toggleMissionPeriod}
                  accessibilityLabel="기간 설정"
                />
              </View>
              {missionHasPeriod ? (
                <Pressable
                  onPress={() => setShowPeriodSheet(true)}
                  accessibilityRole="button"
                  accessibilityLabel="미션 기간 선택"
                  style={[styles.missionInput, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[Typography.supporting, { color: t.text }]}>
                    {formatDate(missionStart)} ~ {missionEnd ? formatDate(missionEnd) : '무기한'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowCreateMission(false)}
                accessibilityRole="button"
                accessibilityLabel="미션 만들기 취소"
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={submitMission}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmitMission }}
                accessibilityLabel="미션 만들기 확인"
                style={[
                  styles.modalBtn,
                  { backgroundColor: canSubmitMission ? t.primary : t.disabledBg },
                ]}>
                <Text
                  style={[
                    Typography.label,
                    { color: canSubmitMission ? t.onPrimary : t.textMuted },
                  ]}>
                  만들기
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Mission period picker — its overlay (zIndex 100) sits above the modal. */}
      <DateRangeSheet
        visible={showPeriodSheet}
        initialStartDate={missionStart}
        initialEndDate={missionEnd}
        onSave={(start, end) => {
          setMissionStart(start);
          setMissionEnd(end);
        }}
        onClose={() => setShowPeriodSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
  },
  emptyBody: {
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: Spacing.two,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 18,
  },
  body: {
    paddingBottom: Spacing.six,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  dot: {
    height: 6,
    borderRadius: Radius.pill,
  },
  floors: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  floor: {
    gap: Spacing.two,
  },
  floorRooms: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  roomCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    overflow: 'hidden',
  },
  roomPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  roomPreviewFill: {
    width: '100%',
    height: '100%',
  },
  // Over a room preview the name drops to the bottom edge on a dark scrim.
  roomNameOverlay: {
    position: 'absolute',
    bottom: Spacing.one,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  roomName: {
    fontWeight: '600',
  },
  myTag: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  myTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  card: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.five,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.two,
  },
  codeBox: {
    marginTop: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  code: {
    letterSpacing: 4,
  },
  memberList: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  myBadge: {
    fontSize: 9,
    fontWeight: '700',
    overflow: 'hidden',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  kickBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    borderRadius: Radius.lg,
    padding: Spacing.four,
  },
  // The edit form scrolls (cover grid makes it taller than small screens).
  editScroll: {
    flexGrow: 0,
  },
  modalBody: {
    marginTop: Spacing.two,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  modalBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  goals: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  hero: {
    position: 'relative',
    height: 132,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroPill: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  // 커버 위 고정 밝기 요소들 — 테마와 무관해 literal 잉크를 쓴다.
  heroPillText: {
    color: '#4A403A',
    fontWeight: '700',
  },
  heroNav: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNavLeft: { left: Spacing.two },
  heroNavRight: { right: Spacing.two },
  heroFoot: {
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  heroName: { color: '#FFFFFF' },
  heroMeta: { color: 'rgba(255,255,255,0.85)' },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  statV: {
    fontSize: 18,
    fontWeight: '800',
  },
  missionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  missionAddBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  missionFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  missionBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  missionForm: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  missionInput: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  missionTypeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  missionTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  editHouseBtn: {
    marginTop: Spacing.two,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  leaveWrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
  codeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reissueBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  leaveHint: {
    textAlign: 'center',
  },
  leaveBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  capacityBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  roomNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  missionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  ownerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  goalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  goalTrack: {
    height: 6,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
});
