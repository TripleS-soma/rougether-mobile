import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/components/ui/icon';
import {
  CrownPictogram,
  HousePictogram,
  Pictogram,
  type PictogramName,
  SparklePictogram,
} from '@/components/ui/pictograms';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';

/** Browse-card display model (decorated from the API house summary). */
export type SearchHouse = {
  id: string;
  name: string;
  members: number;
  capacity: number;
  tag: string;
  /** Server cover art; the pictogram tile is the fallback. */
  coverImageKey?: string;
  icon: PictogramName;
  bg: string;
  border: string;
  /** House growth level (meta line, "Lv.N"). */
  level?: number;
  /** Optional intro line — the server summary has none today (demo data only). */
  description?: string;
  /** Current user's latest browse-join request for this house. */
  joinRequestStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
};

/** Pre-join preview of the house behind an invite code (GET /houses/by-code). */
export type HousePreview = {
  name: string;
  members: number;
  capacity?: number;
  /** The code exists but is expired — joining would fail. */
  expired?: boolean;
};

export type HouseSearchScreenProps = {
  /** Browsable houses from the API (`GET /houses`). */
  houses?: SearchHouse[];
  /** True while the browse list is loading. */
  loading?: boolean;
  onBack?: () => void;
  /**
   * Join with an invite code; resolves true on success (the caller navigates),
   * false shows an inline error.
   */
  onJoinByCode?: (code: string) => Promise<boolean>;
  /**
   * Preview the house behind a code before joining; null = unknown code.
   * When provided, 입주 first shows the house name/headcount for confirmation.
   */
  onPreviewCode?: (code: string) => Promise<HousePreview | null>;
  /** Join a browsable house directly by its id. */
  onJoinHouse?: (houseId: string) => void;
  onCreate?: () => void;
};

/**
 * House search, ported from the prototype `HouseSearchScreen`: invite-code join,
 * search, recommended list (fetched from the business API via MSW), create-new.
 * Theme tokens + type scale; icons emoji.
 */
export function HouseSearchScreen({
  houses = [],
  loading = false,
  onBack,
  onJoinByCode,
  onPreviewCode,
  onJoinHouse,
  onCreate,
}: HouseSearchScreenProps) {
  const t = useTokens();
  const headerInset = useHeaderInsetStyle();
  const [code, setCode] = useState('');
  const { show: toast } = useToast();
  const [query, setQuery] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  // Pre-join preview card (code + house info), shown after a successful lookup.
  const [preview, setPreview] = useState<{ code: string; info: HousePreview } | null>(null);

  const filtered = houses.filter(
    (h) =>
      query.length === 0 ||
      h.name.toLowerCase().includes(query.toLowerCase()) ||
      h.tag.toLowerCase().includes(query.toLowerCase()),
  );

  const joinByCode = async () => {
    const trimmed = code.trim().toUpperCase();
    // Blocked taps explain themselves; only the in-flight state stays dead.
    if (trimmed.length === 0) return toast('초대 코드를 입력해주세요', 'error');
    if (trimmed.length < 6) {
      setCodeError('초대코드는 6자리 이상이에요');
      return;
    }
    setCodeError(null);
    setPreview(null);
    setJoining(true);
    // With a preview handler, look the code up first and ask for confirmation;
    // otherwise (demo/legacy) join directly.
    if (onPreviewCode) {
      const info = await onPreviewCode(trimmed);
      setJoining(false);
      if (!info) setCodeError('초대코드를 확인해주세요. 만료되었거나 없는 코드예요.');
      else if (info.expired) setCodeError('만료된 초대코드예요. 새 코드를 받아주세요.');
      else setPreview({ code: trimmed, info });
      return;
    }
    const ok = (await onJoinByCode?.(trimmed)) ?? false;
    setJoining(false);
    if (!ok) setCodeError('초대코드를 확인해주세요. 만료되었거나 없는 코드예요.');
  };

  const confirmJoinPreview = async () => {
    if (!preview) return;
    setJoining(true);
    const ok = (await onJoinByCode?.(preview.code)) ?? false;
    setJoining(false);
    if (ok) setPreview(null);
    else setCodeError('입주에 실패했어요. 만석이거나 이미 참여 중일 수 있어요.');
  };

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
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
                disabled={joining}
                accessibilityRole="button"
                accessibilityState={{ disabled: code.trim().length === 0 }}
                style={[
                  styles.sideBtn,
                  { backgroundColor: code.trim().length === 0 ? t.disabledBg : t.primary },
                ]}>
                <Text
                  style={[
                    Typography.label,
                    { color: code.trim().length === 0 ? t.textMuted : t.onPrimary },
                  ]}>
                  입주
                </Text>
              </Pressable>
            </View>
            {codeError ? <Text style={[styles.msg, { color: t.danger }]}>{codeError}</Text> : null}

            {preview ? (
              <View style={[styles.previewCard, { backgroundColor: t.surfaceMuted }]}>
                <View style={styles.iconLabelRow}>
                  <HousePictogram size={14} />
                  <Text style={[Typography.label, { color: t.text }]}>{preview.info.name}</Text>
                </View>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  멤버 {preview.info.members}
                  {preview.info.capacity ? ` / ${preview.info.capacity}` : ''}명이 함께 살고 있어요
                </Text>
                <View style={styles.previewActions}>
                  <Pressable
                    onPress={() => setPreview(null)}
                    accessibilityRole="button"
                    accessibilityLabel="입주 취소"
                    style={[styles.previewBtn, { backgroundColor: t.surface }]}>
                    <Text style={[Typography.label, { color: t.text }]}>취소</Text>
                  </Pressable>
                  <Pressable
                    onPress={confirmJoinPreview}
                    disabled={joining}
                    accessibilityRole="button"
                    accessibilityLabel="이 집에 입주"
                    style={[styles.previewBtn, { backgroundColor: t.primary }]}>
                    <Text style={[Typography.label, { color: t.onPrimary }]}>이 집에 입주</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Search */}
        <View style={styles.section}>
          <View style={styles.iconLabelRow}>
            <SparklePictogram size={14} />
            <Text style={[Typography.label, { color: t.text }]}>추천 집 둘러보기</Text>
          </View>
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
              const pending = h.joinRequestStatus === 'PENDING';
              const accepted = h.joinRequestStatus === 'ACCEPTED';
              return (
                <View key={h.id} style={[styles.houseRow, { backgroundColor: t.surface }]}>
                  <View
                    style={[styles.houseEmoji, { backgroundColor: h.bg, borderColor: h.border }]}>
                    {/* Server cover art first; the pictogram tile is the fallback. */}
                    {isCdnKey(h.coverImageKey) ? (
                      <Image
                        source={assetSource(h.coverImageKey)}
                        style={styles.houseCover}
                        contentFit="cover"
                        transition={120}
                        accessibilityLabel={`${h.name} 대표 이미지`}
                        testID="house-cover"
                      />
                    ) : (
                      <Pictogram name={h.icon} size={28} />
                    )}
                  </View>
                  <View style={styles.flex}>
                    {/* The name owns its row — a same-row tag chip squeezed it
                        into truncating even short names (#234). */}
                    <Text style={[Typography.label, { color: t.text }]} numberOfLines={1}>
                      {h.name}
                    </Text>
                    {h.description ? (
                      <Text
                        style={[Typography.supporting, { color: t.textMuted }]}
                        numberOfLines={1}>
                        {h.description}
                      </Text>
                    ) : null}
                    <View style={styles.houseMetaRow}>
                      <View style={[styles.tag, { backgroundColor: h.bg }]}>
                        <Text style={[styles.tagText, { color: t.onTint }]}>#{h.tag}</Text>
                      </View>
                      <Text style={[styles.meta, { color: t.textMuted }]} numberOfLines={1}>
                        {h.level != null ? `Lv.${h.level} · ` : ''}멤버 {h.members} / {h.capacity}
                        {full ? <Text style={{ color: t.danger }}> · 만석</Text> : null}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() =>
                      full
                        ? toast('정원이 가득 찼어요', 'error')
                        : pending
                          ? toast('방장의 수락을 기다리고 있어요')
                          : accepted
                            ? toast('이미 입주가 완료됐어요')
                            : onJoinHouse?.(h.id)
                    }
                    accessibilityRole="button"
                    accessibilityState={{ disabled: full || pending || accepted }}
                    style={[
                      styles.joinBtn,
                      {
                        backgroundColor: full || pending || accepted ? t.surfaceMuted : t.primary,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.joinText,
                        { color: full || pending || accepted ? t.textMuted : t.onPrimary },
                      ]}>
                      {full
                        ? '만석'
                        : pending
                          ? '신청 중'
                          : accepted
                            ? '입주 완료'
                            : h.joinRequestStatus === 'REJECTED'
                              ? '다시 신청'
                              : '입주 신청'}
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
          <View style={styles.iconLabelRow}>
            <CrownPictogram size={14} />
            <Text style={[Typography.label, { color: t.textMuted }]}>새 집 만들기</Text>
          </View>
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
  previewCard: {
    marginTop: Spacing.two,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  previewBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
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
    overflow: 'hidden',
  },
  houseCover: {
    width: '100%',
    height: '100%',
  },
  iconLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  // 320px에선 태그+메타가 한 줄에 안 들어간다(#291) — 메타가 아랫줄로 내려간다.
  houseMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: 2,
  },
  tag: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  tagText: { fontSize: 10, fontWeight: '700' },
  // flexShrink를 주면 줄바꿈 대신 계속 줄어들며 잘린다 — 온전한 너비로 개행.
  meta: { fontSize: 11 },
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
