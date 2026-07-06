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
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

export type RoomCell = {
  name: string;
  /** Tile background tint (kept from the prototype palette). */
  color: string;
  isMine?: boolean;
  /** API membership id — enables the server kick action when provided. */
  membershipId?: number;
  /** API user id — the friend's room owner id (guestbook, room visit). */
  userId?: number;
};

/** Context handed to onVisitFriend — ids enable server features (방명록). */
export type VisitedFriend = {
  name: string;
  userId?: number;
  houseId?: number;
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
  /** Group missions shown in the "우리 그룹의 미션" card. */
  missions?: HouseMission[];
  /** House intro + capacity — prefill for the owner's edit form. */
  description?: string;
  maxMembers?: number;
  memberCount?: number;
};

/** Owner's house-settings edit (PUT /houses/{id}; omitted fields are kept). */
export type HouseEditInput = {
  name: string;
  description?: string;
  maxMembers?: number;
};

/** Capacity choices for the edit form (server allows 1~10). */
const CAPACITY_OPTIONS = [2, 3, 4, 6, 8, 10];

/** Group mission (server house mission) shown in the missions card. */
export type HouseMission = {
  id: number;
  title: string;
  /** Mission-type description shown under the progress bar. */
  desc: string;
  emoji: string;
  current: number;
  target: number;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  /** Target reached — the reward is claimable while ACTIVE. */
  achieved?: boolean;
};

/** Creatable mission types (STREAK_DAYS is not supported by the server yet). */
export type NewHouseMission = {
  title: string;
  missionType: 'DAILY_MEMBER_RATE' | 'WEEKLY_MEMBER_COUNT';
  targetValue: number;
};

const MISSION_TYPE_OPTIONS: { type: NewHouseMission['missionType']; label: string }[] = [
  { type: 'DAILY_MEMBER_RATE', label: '☀️ 일일 달성률' },
  { type: 'WEEKLY_MEMBER_COUNT', label: '📅 주간 달성 횟수' },
];

const DEMO_MISSIONS: HouseMission[] = [
  { id: 1, title: '이번 주 다같이 루틴 지키기', desc: '주간 구성원 달성 횟수', emoji: '📅', current: 12, target: 20, status: 'ACTIVE' }, // prettier-ignore
  { id: 2, title: '아침 기상 인증 모으기', desc: '일일 구성원 달성률', emoji: '☀️', current: 8, target: 8, status: 'ACTIVE', achieved: true }, // prettier-ignore
  { id: 3, title: '지난주 스트레칭 미션', desc: '주간 구성원 달성 횟수', emoji: '📅', current: 20, target: 20, status: 'COMPLETED' }, // prettier-ignore
];

const DEFAULT_HOUSES: House[] = [
  {
    title: '소마파이팅',
    inviteCode: 'SOMA-2143',
    missions: DEMO_MISSIONS,
    floors: [
      {
        level: '2층',
        rooms: [
          { name: '최준서', color: '#F5E1D8' },
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
    missions: DEMO_MISSIONS.slice(0, 1),
    floors: [
      {
        level: '2층',
        rooms: [
          { name: '김도현', color: '#E4DCF0' },
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
  coinBalance?: number;
  characterId?: CharacterId;
  onVisitFriend?: (friend: VisitedFriend) => void;
  onVisitMyRoom?: () => void;
  onOpenSearch?: () => void;
  /** Kick a member via the API (owner only); shown when the house has ids. */
  onKickMember?: (houseId: number, membershipId: number) => void;
  /** Leave the current house via the API. */
  onLeaveHouse?: (houseId: number) => void;
  /** Add my +1 contribution to an active mission. */
  onContributeMission?: (houseId: number, missionId: number) => void;
  /** Claim the reward of an achieved mission. */
  onClaimMission?: (houseId: number, missionId: number) => void;
  /** Create a new group mission. */
  onCreateMission?: (houseId: number, input: NewHouseMission) => void;
  /** Edit the house settings via the API (owner only). */
  onUpdateHouse?: (houseId: number, input: HouseEditInput) => void;
  /** Hand the OWNER role to a member via the API (owner only). */
  onTransferOwnership?: (houseId: number, membershipId: number) => void;
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
  coinBalance = 0,
  characterId = DEFAULT_CHARACTER_ID,
  onVisitFriend,
  onVisitMyRoom,
  onOpenSearch,
  onKickMember,
  onLeaveHouse,
  onContributeMission,
  onClaimMission,
  onCreateMission,
  onUpdateHouse,
  onTransferOwnership,
}: GroupHouseScreenProps) {
  const t = useTokens();
  const screenStyle = useScreenStyle();

  const [houseIndex, setHouseIndex] = useState(0);
  const [showMembers, setShowMembers] = useState(false);
  const [kicked, setKicked] = useState<string[]>([]);
  const [memberToKick, setMemberToKick] = useState<RoomCell | null>(null);
  const [showCreateMission, setShowCreateMission] = useState(false);
  const [missionTitle, setMissionTitle] = useState('');
  const [missionType, setMissionType] =
    useState<NewHouseMission['missionType']>('WEEKLY_MEMBER_COUNT');
  const [missionTarget, setMissionTarget] = useState('10');
  const [showEditHouse, setShowEditHouse] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMax, setEditMax] = useState<number | undefined>(undefined);
  const [transferTarget, setTransferTarget] = useState<RoomCell | null>(null);

  const currentHouse: House | undefined = houses[Math.min(houseIndex, houses.length - 1)];
  const members = useMemo(
    () =>
      (currentHouse?.floors ?? []).flatMap((f) => f.rooms.map((r) => ({ ...r, level: f.level }))),
    [currentHouse],
  );
  const keyFor = (name: string) => `${houseIndex}-${name}`;
  const isKicked = (name: string) => kicked.includes(keyFor(name));

  const prevHouse = () => setHouseIndex((i) => (i - 1 + houses.length) % houses.length);
  const nextHouse = () => setHouseIndex((i) => (i + 1) % houses.length);

  const missions = currentHouse?.missions ?? [];
  // Creating needs the server house id; demo houses only display missions.
  const canCreateMission = !!(onCreateMission && currentHouse?.houseId);
  const missionTargetNum = Number(missionTarget);
  const canSubmitMission =
    missionTitle.trim().length > 0 &&
    Number.isInteger(missionTargetNum) &&
    missionTargetNum >= 1 &&
    missionTargetNum <= 1000;
  const submitMission = () => {
    if (!canSubmitMission || !currentHouse?.houseId) return;
    onCreateMission?.(currentHouse.houseId, {
      title: missionTitle.trim(),
      missionType,
      targetValue: missionTargetNum,
    });
    setShowCreateMission(false);
    setMissionTitle('');
    setMissionTarget('10');
  };
  // Owner tools need the OWNER role and a server house id.
  const isOwner = currentHouse?.myRole === 'OWNER' && !!currentHouse?.houseId;
  const openEditHouse = () => {
    setEditName(currentHouse?.title ?? '');
    setEditDesc(currentHouse?.description ?? '');
    setEditMax(currentHouse?.maxMembers);
    setShowEditHouse(true);
  };
  const editNameValid = editName.trim().length >= 2 && editName.trim().length <= 30;
  const submitEditHouse = () => {
    if (!editNameValid || !currentHouse?.houseId) return;
    onUpdateHouse?.(currentHouse.houseId, {
      name: editName.trim(),
      description: editDesc.trim() || undefined,
      maxMembers: editMax,
    });
    setShowEditHouse(false);
  };
  const confirmTransfer = () => {
    if (transferTarget?.membershipId && currentHouse?.houseId) {
      onTransferOwnership?.(currentHouse.houseId, transferTarget.membershipId);
    }
    setTransferTarget(null);
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
        <View style={[styles.header, { backgroundColor: t.surface }]}>
          <View style={styles.flex}>
            <Text style={[Typography.supporting, { color: t.primary }]}>{currentHouse.title}</Text>
            <Text style={[Typography.h3, { color: t.text }]}>구성원 관리</Text>
          </View>
          <Pressable
            onPress={() => setShowMembers(false)}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="close" size={18} color={t.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {currentHouse.inviteCode ? (
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[Typography.label, { color: t.text }]}>초대코드</Text>
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
                <Text style={[Typography.label, { color: t.primary }]}>✏️ 집 정보 수정</Text>
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
                      {member.isMine ? (
                        <Text
                          style={[styles.myBadge, { backgroundColor: t.warning, color: t.text }]}>
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
                      <Text style={[Typography.supporting, { color: t.primary }]}>위임</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => setMemberToKick(member)}
                    disabled={member.isMine || kickedOut}
                    accessibilityRole="button"
                    accessibilityLabel={`${member.name} 강퇴`}
                    style={[
                      styles.kickBtn,
                      {
                        backgroundColor:
                          member.isMine || kickedOut ? t.surfaceMuted : `${t.danger}22`,
                      },
                    ]}>
                    <Text
                      style={[
                        Typography.supporting,
                        { color: member.isMine || kickedOut ? t.textDisabled : t.danger },
                      ]}>
                      {kickedOut ? '강퇴됨' : '강퇴'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>

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
              <View style={styles.missionForm}>
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
                        onPress={() => setEditMax(n)}
                        disabled={tooSmall}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
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
              </View>
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
                  disabled={!editNameValid}
                  accessibilityRole="button"
                  accessibilityLabel="집 정보 저장"
                  style={[
                    styles.modalBtn,
                    { backgroundColor: editNameValid ? t.primary : t.disabledBg },
                  ]}>
                  <Text style={[Typography.label, { color: t.onPrimary }]}>저장</Text>
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
      <View style={[styles.header, { backgroundColor: t.surface }]}>
        <View style={[styles.pill, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[Typography.label, { color: t.text }]}>👑 Lv.20</Text>
        </View>
        <View style={styles.flex} />
        <View style={[styles.pill, styles.leafPill, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="coin" size={16} color={t.warning} />
          <Text style={[Typography.label, { color: t.text }]}>{coinBalance.toLocaleString()}</Text>
        </View>
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
        <View style={styles.switcher}>
          <Pressable
            onPress={prevHouse}
            accessibilityRole="button"
            accessibilityLabel="이전 집"
            style={[styles.iconBtn, { backgroundColor: t.surface }]}>
            <Icon name="back" size={18} color={t.text} />
          </Pressable>
          <View style={[styles.titleBadge, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[Typography.h3, { color: t.text }]}>👑 {currentHouse.title}</Text>
          </View>
          <Pressable
            onPress={nextHouse}
            accessibilityRole="button"
            accessibilityLabel="다음 집"
            style={[styles.iconBtn, { backgroundColor: t.surface }]}>
            <Icon name="forward" size={18} color={t.text} />
          </Pressable>
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

        <View style={styles.floors}>
          {currentHouse.floors.map((floor) => (
            <View key={floor.level} style={styles.floor}>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>{floor.level}</Text>
              <View style={styles.floorRooms}>
                {floor.rooms.map((room) => {
                  const empty = isKicked(room.name);
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
                      {room.isMine ? (
                        <View style={[styles.myTag, { backgroundColor: t.warning }]}>
                          <Text style={[styles.myTagText, { color: t.text }]}>MY</Text>
                        </View>
                      ) : null}
                      {empty ? (
                        <Icon name="leave" size={36} color={t.textMuted} />
                      ) : (
                        <CharacterAvatar characterId={characterId} size={64} />
                      )}
                      <Text style={[Typography.supporting, styles.roomName, { color: t.text }]}>
                        {empty ? '빈방' : room.isMine ? `${room.name} (나)` : room.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.missionHead}>
            <Text style={[Typography.h3, styles.flex, { color: t.text }]}>🎯 우리 그룹의 미션</Text>
            {canCreateMission ? (
              <Pressable
                onPress={() => setShowCreateMission(true)}
                accessibilityRole="button"
                accessibilityLabel="미션 만들기"
                style={[styles.missionAddBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.supporting, { color: t.primary }]}>＋ 만들기</Text>
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
                    <Text style={styles.goalEmoji}>{mission.emoji}</Text>
                    <View style={styles.flex}>
                      <View style={styles.goalHead}>
                        <Text
                          style={[Typography.label, styles.flex, { color: t.text }]}
                          numberOfLines={1}>
                          {mission.title}
                        </Text>
                        <Text style={[Typography.supporting, { color: t.primary }]}>
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
                        {mission.status === 'COMPLETED' ? (
                          <Text style={[Typography.supporting, { color: t.textMuted }]}>
                            완료 🎉
                          </Text>
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
                              🎁 보상 받기
                            </Text>
                          </Pressable>
                        ) : mission.status === 'ACTIVE' &&
                          currentHouse.houseId &&
                          onContributeMission ? (
                          <Pressable
                            onPress={() => onContributeMission(currentHouse.houseId!, mission.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`${mission.title} 기여하기`}
                            style={[styles.missionBtn, { backgroundColor: t.primary }]}>
                            <Text style={[Typography.supporting, { color: t.onPrimary }]}>
                              기여 +1
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
                disabled={!canSubmitMission}
                accessibilityRole="button"
                accessibilityLabel="미션 만들기 확인"
                style={[
                  styles.modalBtn,
                  { backgroundColor: canSubmitMission ? t.primary : t.disabledBg },
                ]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>만들기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
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
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  leafPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  body: {
    paddingBottom: Spacing.six,
  },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  titleBadge: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
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
    borderRadius: Radius.lg,
    padding: Spacing.four,
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
  goalEmoji: {
    fontSize: 20,
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
