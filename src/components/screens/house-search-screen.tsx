import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

const ERROR = '#D67878';
const DISABLED = '#E5DACB';

type House = {
  id: string;
  name: string;
  members: number;
  capacity: number;
  tag: string;
  emoji: string;
  bg: string;
  border: string;
  description: string;
};

const RECOMMENDED: House[] = [
  {
    id: 'h1',
    name: '아침형 인간 모임',
    members: 3,
    capacity: 4,
    tag: '기상',
    emoji: '🌅',
    bg: '#FFEFD8',
    border: '#F0C88A',
    description: '오전 7시 전 기상 인증을 함께 해요',
  },
  {
    id: 'h2',
    name: '개발자 루틴',
    members: 4,
    capacity: 4,
    tag: '코딩',
    emoji: '💻',
    bg: '#E4F0DC',
    border: '#A8C898',
    description: '매일 코테 한 문제씩, 함께 성장하기',
  },
  {
    id: 'h3',
    name: '독서 1시간',
    members: 2,
    capacity: 4,
    tag: '독서',
    emoji: '📖',
    bg: '#E4DCF0',
    border: '#B8A8D8',
    description: '하루 1시간 독서하고 한줄평 남기기',
  },
  {
    id: 'h4',
    name: '홈트 챌린지',
    members: 3,
    capacity: 4,
    tag: '운동',
    emoji: '💪',
    bg: '#FBE0E0',
    border: '#E8B0A0',
    description: '주 3회 홈트 인증 그룹',
  },
  {
    id: 'h5',
    name: '물 2L 클럽',
    members: 4,
    capacity: 4,
    tag: '건강',
    emoji: '💧',
    bg: '#D8E8F0',
    border: '#A8C4D8',
    description: '하루 물 2L 마시기 인증',
  },
];

export type HouseSearchScreenProps = {
  onBack?: () => void;
  onJoin?: (houseName: string) => void;
  onCreate?: () => void;
};

/** House search, ported from the prototype `HouseSearchScreen`: invite-code join,
 * search, recommended list, create-new. Theme tokens + type scale; icons emoji. */
export function HouseSearchScreen({ onBack, onJoin, onCreate }: HouseSearchScreenProps) {
  const t = useTokens();
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const filtered = RECOMMENDED.filter(
    (h) =>
      query.length === 0 ||
      h.name.toLowerCase().includes(query.toLowerCase()) ||
      h.tag.toLowerCase().includes(query.toLowerCase()),
  );

  const joinByCode = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) {
      setCodeError('초대코드는 6자리 이상이에요');
      return;
    }
    setCodeError(null);
    onJoin?.(`초대코드 ${trimmed}`);
  };

  return (
    <View style={[styles.screen, { backgroundColor: t.screen }]}>
      <View style={[styles.header, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[styles.backGlyph, { color: t.text }]}>‹</Text>
        </Pressable>
        <Text style={[Typography.h2, { color: t.text }]}>집 탐색</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Invite code */}
        <View style={styles.section}>
          <Text style={[Typography.label, { color: t.text }]}># 초대코드로 들어가기</Text>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            친구에게 받은 초대코드를 입력하면 바로 그 집에 입주할 수 있어요.
          </Text>
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <View style={styles.inlineRow}>
              <View
                style={[
                  styles.inputBox,
                  {
                    backgroundColor: t.surfaceMuted,
                    borderColor: codeError ? ERROR : 'transparent',
                  },
                ]}>
                <TextInput
                  style={[styles.input, styles.codeInput, { color: t.text }]}
                  value={code}
                  onChangeText={(v) => {
                    setCode(v.toUpperCase().slice(0, 8));
                    setCodeError(null);
                  }}
                  placeholder="예: VLG-7K2X"
                  placeholderTextColor={t.textMuted}
                  autoCapitalize="characters"
                />
              </View>
              <Pressable
                onPress={joinByCode}
                disabled={code.trim().length === 0}
                accessibilityRole="button"
                style={[
                  styles.sideBtn,
                  { backgroundColor: code.trim().length === 0 ? DISABLED : t.primary },
                ]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>입주</Text>
              </Pressable>
            </View>
            {codeError ? <Text style={[styles.msg, { color: ERROR }]}>{codeError}</Text> : null}
          </View>
        </View>

        {/* Search */}
        <View style={styles.section}>
          <Text style={[Typography.label, { color: t.text }]}>✨ 추천 집 둘러보기</Text>
          <View style={[styles.searchBox, { backgroundColor: t.surface }]}>
            <Text style={styles.icon}>🔍</Text>
            <TextInput
              style={[styles.input, { color: t.text }]}
              value={query}
              onChangeText={setQuery}
              placeholder="집 이름, 태그로 검색"
              placeholderTextColor={t.textMuted}
            />
          </View>
        </View>

        {/* Recommended list */}
        <View style={styles.list}>
          {filtered.length === 0 ? (
            <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
              검색 결과가 없어요
            </Text>
          ) : (
            filtered.map((h) => {
              const full = h.members >= h.capacity;
              return (
                <View key={h.id} style={[styles.houseRow, { backgroundColor: t.surface }]}>
                  <View
                    style={[styles.houseEmoji, { backgroundColor: h.bg, borderColor: h.border }]}>
                    <Text style={styles.houseEmojiText}>{h.emoji}</Text>
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.houseTitleRow}>
                      <Text style={[Typography.label, { color: t.text }]} numberOfLines={1}>
                        {h.name}
                      </Text>
                      <View style={[styles.tag, { backgroundColor: h.bg }]}>
                        <Text style={styles.tagText}>#{h.tag}</Text>
                      </View>
                    </View>
                    <Text style={[Typography.supporting, { color: t.textMuted }]} numberOfLines={1}>
                      {h.description}
                    </Text>
                    <Text style={[styles.meta, { color: t.textMuted }]}>
                      👥 {h.members} / {h.capacity}
                      {full ? <Text style={{ color: ERROR }}> · 만석</Text> : null}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => !full && onJoin?.(h.name)}
                    disabled={full}
                    accessibilityRole="button"
                    style={[
                      styles.joinBtn,
                      { backgroundColor: full ? t.surfaceMuted : t.primary },
                    ]}>
                    <Text style={[styles.joinText, { color: full ? t.textMuted : t.onPrimary }]}>
                      {full ? '대기' : '입주 신청'}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        {/* Create */}
        <Pressable
          onPress={onCreate}
          accessibilityRole="button"
          style={[styles.createBtn, { borderColor: DISABLED }]}>
          <Text style={[Typography.label, { color: t.textMuted }]}>👑 새 집 만들기</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  backGlyph: { fontSize: 26, lineHeight: 28 },
  body: { padding: Spacing.four, gap: Spacing.four },
  section: { gap: Spacing.two },
  card: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two },
  inlineRow: { flexDirection: 'row', gap: Spacing.two },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: Spacing.half },
  codeInput: { letterSpacing: 2 },
  sideBtn: {
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  icon: { fontSize: 16 },
  msg: { fontSize: 12, marginLeft: Spacing.one },
  list: { gap: Spacing.two },
  houseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  houseEmoji: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  houseEmojiText: { fontSize: 24 },
  houseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  tag: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  tagText: { fontSize: 10, fontWeight: '700', color: '#4A403A' },
  meta: { fontSize: 11, marginTop: 2 },
  joinBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  joinText: { fontSize: 12, fontWeight: '600' },
  createBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
});
