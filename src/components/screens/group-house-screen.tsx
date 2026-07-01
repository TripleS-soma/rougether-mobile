import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
};

export type Floor = { level: string; rooms: RoomCell[] };

export type House = { title: string; inviteCode: string; floors: Floor[] };

/** Group goal shown in the "우리 그룹의 루틴" card. */
type GroupGoal = { emoji: string; title: string; desc: string; current: number; goal: number };

const GROUP_GOALS: GroupGoal[] = [
  { emoji: '☀️', title: '80% 이상 기상 인증', desc: '오전 7시 전 기상', current: 3, goal: 4 },
  { emoji: '💻', title: '이번 달 코테 문제 풀이 인증', desc: '10회 목표', current: 6, goal: 10 },
  { emoji: '🏋️', title: '주 3회 운동 인증', desc: '전체 멤버 평균', current: 2, goal: 3 },
];

const DEFAULT_HOUSES: House[] = [
  {
    title: '소마파이팅',
    inviteCode: 'SOMA-2143',
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
  leafBalance?: number;
  characterId?: CharacterId;
  onVisitFriend?: (name: string) => void;
  onVisitMyRoom?: () => void;
  onOpenSearch?: () => void;
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
  leafBalance = 0,
  characterId = DEFAULT_CHARACTER_ID,
  onVisitFriend,
  onVisitMyRoom,
  onOpenSearch,
}: GroupHouseScreenProps) {
  const t = useTokens();
  const screenStyle = useScreenStyle();

  const [houseIndex, setHouseIndex] = useState(0);
  const [showMembers, setShowMembers] = useState(false);
  const [kicked, setKicked] = useState<string[]>([]);
  const [memberToKick, setMemberToKick] = useState<string | null>(null);

  const currentHouse = houses[Math.min(houseIndex, houses.length - 1)];
  const members = useMemo(
    () => currentHouse.floors.flatMap((f) => f.rooms.map((r) => ({ ...r, level: f.level }))),
    [currentHouse],
  );
  const keyFor = (name: string) => `${houseIndex}-${name}`;
  const isKicked = (name: string) => kicked.includes(keyFor(name));

  const prevHouse = () => setHouseIndex((i) => (i - 1 + houses.length) % houses.length);
  const nextHouse = () => setHouseIndex((i) => (i + 1) % houses.length);
  const confirmKick = () => {
    if (memberToKick) setKicked((prev) => [...prev, keyFor(memberToKick)]);
    setMemberToKick(null);
  };

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
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[Typography.label, { color: t.text }]}>초대코드</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              친구에게 코드를 공유해 집에 초대하세요.
            </Text>
            <View
              style={[styles.codeBox, { borderColor: t.border, backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.h3, styles.code, { color: t.text }]}>
                {currentHouse.inviteCode}
              </Text>
            </View>
          </View>

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
                  <Pressable
                    onPress={() => setMemberToKick(member.name)}
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
                {memberToKick}님을 강퇴하면 집 화면에서 빈방으로 표시됩니다.
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
          <Icon name="leaf" size={16} color={t.text} />
          <Text style={[Typography.label, { color: t.text }]}>{leafBalance.toLocaleString()}</Text>
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
              key={house.title}
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
                            : onVisitFriend?.(room.name)
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
          <Text style={[Typography.h3, { color: t.text }]}>🎯 우리 그룹의 루틴</Text>
          <View style={styles.goals}>
            {GROUP_GOALS.map((goal) => {
              const pct = Math.min(1, goal.current / goal.goal);
              return (
                <View
                  key={goal.title}
                  style={[styles.goalRow, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                  <View style={styles.flex}>
                    <View style={styles.goalHead}>
                      <Text
                        style={[Typography.label, styles.flex, { color: t.text }]}
                        numberOfLines={1}>
                        {goal.title}
                      </Text>
                      <Text style={[Typography.supporting, { color: t.primary }]}>
                        {goal.current}/{goal.goal}
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
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>{goal.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
