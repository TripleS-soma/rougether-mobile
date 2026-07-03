import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchRecommendedHouses, type HouseSummary } from '@/api/house';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

export type HouseSearchScreenProps = {
  onBack?: () => void;
  onJoin?: (houseName: string) => void;
  onCreate?: () => void;
};

/**
 * House search, ported from the prototype `HouseSearchScreen`: invite-code join,
 * search, recommended list (fetched from the business API via MSW), create-new.
 * Theme tokens + type scale; icons emoji.
 */
export function HouseSearchScreen({ onBack, onJoin, onCreate }: HouseSearchScreenProps) {
  const t = useTokens();
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [houses, setHouses] = useState<HouseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchRecommendedHouses()
      .then((data) => active && setHouses(data))
      .catch(() => active && setHouses([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const filtered = houses.filter(
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
    <View style={[styles.screen, useScreenStyle()]}>
      <View style={[styles.header, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="back" size={26} color={t.text} />
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
                    borderColor: codeError ? t.danger : 'transparent',
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
                  { backgroundColor: code.trim().length === 0 ? t.disabledBg : t.primary },
                ]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>입주</Text>
              </Pressable>
            </View>
            {codeError ? <Text style={[styles.msg, { color: t.danger }]}>{codeError}</Text> : null}
          </View>
        </View>

        {/* Search */}
        <View style={styles.section}>
          <Text style={[Typography.label, { color: t.text }]}>✨ 추천 집 둘러보기</Text>
          <View style={[styles.searchBox, { backgroundColor: t.surface }]}>
            <Icon name="search" size={16} color={t.text} />
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
          {loading ? (
            <ActivityIndicator color={t.primary} style={styles.loading} />
          ) : filtered.length === 0 ? (
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
                      {full ? <Text style={{ color: t.danger }}> · 만석</Text> : null}
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
          style={[styles.createBtn, { borderColor: t.disabledBg }]}>
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
  loading: { paddingVertical: Spacing.six },
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
