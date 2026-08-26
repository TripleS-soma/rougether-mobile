import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { HousePreviewFrame } from '@/components/room/house-preview-frame';
import type { RoomCatalogProps } from '@/components/room/room';
import type { HouseMission, MemberRoomPreview } from '@/components/screens/house-screen';
import { Loading } from '@/components/ui/loading';
import { Icon } from '@/components/ui/icon';
import { RetryState } from '@/components/ui/retry-state';
import { SpringProgressBar } from '@/components/ui/spring-progress';
import {
  CrownPictogram,
  HousePictogram,
  Pictogram,
  type PictogramName,
  SparklePictogram,
} from '@/components/ui/pictograms';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';

/** Browse-card display model (decorated from the API house summary). */
export type SearchHouse = {
  id: number;
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
  /** 방장 승인 후 입장하는 코드 (#648) — 입주 대신 신청이 생성됨을 미리 안내. */
  requiresApproval?: boolean;
};

/** 탐색 카드 탭 → 참여 전 집 미리보기 (GET /houses/{id}/preview, #328). */
export type HousePreviewDetail = {
  id: number;
  name: string;
  description?: string;
  coverImageKey?: string;
  members: number;
  capacity?: number;
  level?: number;
  /** Goal names shown as chips. */
  goals: string[];
  /** Requester is already an active member — joining is meaningless. */
  isMember?: boolean;
  /** At capacity — the join button disables. */
  isFull?: boolean;
  /** 구성원별 실제 방 (#386, 가입순) — 없으면 인원수 목업으로 폴백. */
  rooms?: MemberRoomPreview[];
  /** 진행 중인 단체 미션 (#532) — 미리보기 시트에 진행도 표시. */
  missions?: HouseMission[];
};

/** 네트워크/서버 오류 안내 (#549) — 잘못된 초대코드 안내와 구분한다. */
const NETWORK_ERROR_MSG = '네트워크를 확인해주세요. 잠시 후 다시 시도해 주세요.';

/** 로딩·오류 중에는 리스트 데이터를 비운다 — 상태 표시는 ListEmptyComponent 몫 (#690). */
const NO_HOUSES: SearchHouse[] = [];

/** 카드 사이 간격 — FlatList 셀에는 컨테이너 gap이 적용되지 않는다. */
function ListGap() {
  return <View style={styles.listGap} />;
}

// RoomCatalogProps: 상점 카탈로그 (#386, #691) — 미리보기 창문의 실제 방 렌더에 필요.
export type HouseSearchScreenProps = RoomCatalogProps & {
  /** Browsable houses from the API (`GET /houses`). */
  houses?: SearchHouse[];
  /** True while the browse list is loading. */
  loading?: boolean;
  /** 다음 페이지가 남았는지 (#975) — 끝에 닿으면 이어 붙인다. */
  hasNext?: boolean;
  /** 다음 페이지를 받는 중 — 푸터 스피너. */
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** True when the browse list failed to load (#549) — 빈 결과와 구분해 표시. */
  loadError?: boolean;
  /** Re-run the failed browse-list load (다시 시도 button). */
  onRetry?: () => void;
  onBack?: () => void;
  /**
   * 초대 링크로 받은 코드 (#624) — 입력을 시드하고 마운트 시 미리보기를 자동
   * 실행해 "링크 탭 → 이 집에 참여할까요?"로 바로 잇는다.
   */
  initialCode?: string;
  /** 자동 미리보기 발화 직후 호출 — 부모가 코드를 비워 재방문 재발화를 막는다. */
  onInitialCodeConsumed?: () => void;
  /**
   * Join with an invite code; resolves true on success (the caller navigates),
   * 'pending' = 부원 개인 코드라 방장 승인 대기 (#646), false = 잘못된/만료
   * 코드, 'network' = 네트워크·서버 오류 (#549 문구 분기).
   */
  onJoinByCode?: (code: string) => Promise<boolean | 'pending' | 'network'>;
  /**
   * Preview the house behind a code before joining; null = unknown code,
   * 'network' = 네트워크·서버 오류 (잘못된 코드와 다른 안내, #549).
   * When provided, 입주 first shows the house name/headcount for confirmation.
   */
  onPreviewCode?: (code: string) => Promise<HousePreview | null | 'network'>;
  /** Join a browsable house directly by its id. */
  onJoinHouse?: (houseId: number) => void;
  /** 참여 전 미리보기 로드 (#328, 미션 진행 포함 #532); null = 실패. */
  onPreviewHouse?: (houseId: number) => Promise<HousePreviewDetail | null>;
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
  hasNext = false,
  loadingMore = false,
  onLoadMore,
  loadError = false,
  onRetry,
  onBack,
  initialCode,
  onInitialCodeConsumed,
  onJoinByCode,
  onPreviewCode,
  onJoinHouse,
  onPreviewHouse,
  furniture,
  wallpapers,
  floors,
  backgrounds,
  onCreate,
}: HouseSearchScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const headerInset = useHeaderInsetStyle();
  const [code, setCode] = useState(initialCode ?? '');
  const { show: toast } = useToast();
  const [query, setQuery] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  // 승인 대기 안내 (#646) — 부원 개인 코드로 신청한 경우의 긍정 안내.
  const [pendingNotice, setPendingNotice] = useState(false);
  const [joining, setJoining] = useState(false);
  const [previewingHouseId, setPreviewingHouseId] = useState<number | null>(null);
  // Pre-join preview card (code + house info), shown after a successful lookup.
  const [preview, setPreview] = useState<{ code: string; info: HousePreview } | null>(null);
  // 탐색 카드 탭 → 미리보기 모달 (#328, 미션 포함 #532). 실패는 훅이 토스트로.
  const [housePreview, setHousePreview] = useState<HousePreviewDetail | null>(null);
  const filtered = useMemo(
    () =>
      houses.filter(
        (h) =>
          query.length === 0 ||
          h.name.toLowerCase().includes(query.toLowerCase()) ||
          h.tag.toLowerCase().includes(query.toLowerCase()),
      ),
    [houses, query],
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
    setPendingNotice(false);
    setPreview(null);
    setJoining(true);
    // With a preview handler, look the code up first and ask for confirmation;
    // otherwise (demo/legacy) join directly.
    if (onPreviewCode) {
      const info = await onPreviewCode(trimmed);
      setJoining(false);
      // 네트워크/서버 오류는 잘못된 코드와 구분해 안내한다 (#549).
      if (info === 'network') setCodeError(NETWORK_ERROR_MSG);
      else if (!info) setCodeError('초대코드를 확인해주세요. 만료되었거나 없는 코드예요.');
      else if (info.expired) setCodeError('만료된 초대코드예요. 새 코드를 받아주세요.');
      else setPreview({ code: trimmed, info });
      return;
    }
    const ok = (await onJoinByCode?.(trimmed)) ?? false;
    setJoining(false);
    if (ok === 'pending') {
      setCode('');
      setPendingNotice(true);
    } else if (ok === 'network') setCodeError(NETWORK_ERROR_MSG);
    else if (!ok) setCodeError('초대코드를 확인해주세요. 만료되었거나 없는 코드예요.');
  };

  // 초대 링크 진입 (#624) — 마운트 1회, 시드된 코드로 미리보기를 자동 실행해
  // 확인 시트("이 집에 참여할까요?")까지 바로 잇는다.
  const autoPreviewRan = useRef(false);
  useEffect(() => {
    if (!initialCode || autoPreviewRan.current) return;
    autoPreviewRan.current = true;
    onInitialCodeConsumed?.();
    void joinByCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회
  }, []);

  const confirmJoinPreview = async () => {
    if (!preview) return;
    setJoining(true);
    const ok = (await onJoinByCode?.(preview.code)) ?? false;
    setJoining(false);
    if (ok === true) setPreview(null);
    else if (ok === 'pending') {
      // 부원 개인 코드 (#646) — 입주 확정 대신 신청이 생성됐다.
      setPreview(null);
      setCode('');
      setPendingNotice(true);
    } else if (ok === 'network') setCodeError(NETWORK_ERROR_MSG);
    else setCodeError('입주에 실패했어요. 만석이거나 이미 참여 중일 수 있어요.');
  };

  const openHousePreview = async (houseId: number) => {
    if (!onPreviewHouse || previewingHouseId) return;
    setPreviewingHouseId(houseId);
    try {
      const detail = await onPreviewHouse(houseId);
      if (detail) setHousePreview(detail);
      else toast('집 미리보기를 불러오지 못했어요', 'error');
    } catch {
      toast('집 미리보기를 불러오지 못했어요', 'error');
    } finally {
      setPreviewingHouseId(null);
    }
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
      {/* 추천 목록이 서버 구동이라 가상화 리스트로 그린다 (#690) — 초대코드·검색은
          헤더, 새 집 만들기는 푸터로. */}
      <FlatList
        data={loading || loadError ? NO_HOUSES : filtered}
        keyExtractor={(h) => String(h.id)}
        contentContainerStyle={[styles.body, column]}
        ItemSeparatorComponent={ListGap}
        // 검색 중에는 이어 붙이지 않는다 — 필터가 클라이언트라 다음 페이지를
        // 받아봐야 화면에 안 걸리는 게 대부분이고, 스크롤이 짧아 끝에 붙어 있어
        // 계속 요청이 나간다 (#975).
        onEndReached={query.length === 0 && hasNext && !loadingMore ? onLoadMore : undefined}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
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
                      // iOS는 letterSpacing이 placeholder에도 걸린다(안드는 미적용) — 값이
                      // 있을 때만 자간을 줘 placeholder 렌더를 플랫폼 동일하게 한다.
                      style={[styles.input, code.length > 0 && styles.codeInput, { color: t.text }]}
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
                {codeError ? (
                  <Text style={[Typography.supporting, styles.msg, { color: t.danger }]}>
                    {codeError}
                  </Text>
                ) : null}
                {pendingNotice ? (
                  <Text style={[Typography.supporting, styles.msg, { color: t.primaryText }]}>
                    입주 신청을 보냈어요. 방장이 승인하면 집에 들어가요.
                  </Text>
                ) : null}

                {preview ? (
                  <View style={[styles.previewCard, { backgroundColor: t.surfaceMuted }]}>
                    <View style={styles.iconLabelRow}>
                      <HousePictogram size={14} />
                      <Text style={[Typography.label, { color: t.text }]}>{preview.info.name}</Text>
                    </View>
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>
                      멤버 {preview.info.members}
                      {preview.info.capacity ? ` / ${preview.info.capacity}` : ''}명이 함께 살고
                      있어요
                    </Text>
                    {preview.info.requiresApproval ? (
                      // 승인형 코드 (#648) — '입주' 탭 후 pending 안내와 기대를 맞춘다.
                      <Text style={[Typography.supporting, { color: t.warningText }]}>
                        방장 승인 후 입장하는 집이에요. 신청을 보내고 기다리게 돼요.
                      </Text>
                    ) : null}
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
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loading style={styles.loading} />
          ) : loadError ? (
            // 로드 실패 (#549) — 빈 검색 결과('검색 결과가 없어요')로 위장하지 않는다.
            <View style={styles.errorBlock}>
              <RetryState message="추천 집 목록을 불러오지 못했어요." onRetry={onRetry} />
            </View>
          ) : (
            <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
              검색 결과가 없어요
            </Text>
          )
        }
        renderItem={({ item: h }) => {
          /**
           * 정원이 다 찼는지 (#948). **이것으로 신청을 막지 않는다** — 동거
           * 봇(서버 #309)이 차지한 자리는 사람이 신청하면 비켜주므로, 4/4인
           * 집도 서버는 받아준다. 목록 응답(`HouseSummary`)에는 서버가
           * 계산한 `isFull`이 없어 앱이 봇 수를 알 방법이 없다. 그래서 수치는
           * 정보로만 보여주고, 진짜 만석은 서버의 `HOUSE_FULL`로 안내한다.
           * (온보딩 기본 집이 사람 1 + 봇 2라 드문 경우가 아니다.)
           */
          const atCapacity = h.members >= h.capacity;
          const pending = h.joinRequestStatus === 'PENDING';
          const accepted = h.joinRequestStatus === 'ACCEPTED';
          return (
            <View key={String(h.id)} style={[styles.houseRow, { backgroundColor: t.surface }]}>
              {/* 카드 본문 탭 = 참여 전 미리보기 (#328); 입주 신청 버튼은 그대로.
                      로딩 중 재탭은 busy로 막는다 (#532). */}
              <Pressable
                onPress={() => void openHousePreview(h.id)}
                disabled={!onPreviewHouse || previewingHouseId !== null}
                accessibilityRole="button"
                accessibilityLabel={`${h.name} 미리보기`}
                accessibilityState={{ busy: previewingHouseId === h.id }}
                style={[styles.flex, styles.houseBody]}>
                <View style={[styles.houseEmoji, { backgroundColor: h.bg, borderColor: h.border }]}>
                  {/* Server cover art first; the pictogram tile is the fallback. */}
                  {isCdnKey(h.coverImageKey) ? (
                    <Image
                      source={assetSource(h.coverImageKey)}
                      style={styles.houseCover}
                      contentFit="cover"
                      cachePolicy="memory-disk"
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
                    <Text style={[Typography.supporting, { color: t.textMuted }]} numberOfLines={1}>
                      {h.description}
                    </Text>
                  ) : null}
                  <View style={styles.houseMetaRow}>
                    <View style={[styles.tag, { backgroundColor: h.bg }]}>
                      <Text style={[styles.tagText, emph('bold'), { color: t.onTint }]}>
                        #{h.tag}
                      </Text>
                    </View>
                    <Text
                      style={[styles.meta, emph('normal'), { color: t.textMuted }]}
                      numberOfLines={1}>
                      {h.level != null ? `Lv.${h.level} · ` : ''}멤버 {h.members} / {h.capacity}
                      {atCapacity ? <Text style={{ color: t.danger }}> · 만석</Text> : null}
                    </Text>
                  </View>
                </View>
                {/* 미리보기 로딩 스피너 (#532). */}
                {previewingHouseId === h.id ? <Loading size="small" /> : null}
              </Pressable>
              {/* 정원이 다 찼어도 눌린다 — 봇이 비켜줄 수 있는지는 서버만 안다.
                  이미 신청 중·입주 완료는 앱이 아는 사실이라 그대로 막는다. */}
              <Pressable
                onPress={() =>
                  pending
                    ? toast('방장의 수락을 기다리고 있어요')
                    : accepted
                      ? toast('이미 입주가 완료됐어요')
                      : onJoinHouse?.(h.id)
                }
                accessibilityRole="button"
                accessibilityState={{ disabled: pending || accepted }}
                style={[
                  styles.joinBtn,
                  {
                    backgroundColor: pending || accepted ? t.surfaceMuted : t.primary,
                  },
                ]}>
                <Text
                  style={[
                    Typography.supporting,
                    emph('semibold'),
                    { color: pending || accepted ? t.textMuted : t.onPrimary },
                  ]}>
                  {pending
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
        }}
        ListFooterComponent={
          <>
            {/* 다음 페이지 로딩 (#975). 끝에 닿으면 알아서 붙으므로 버튼이 없다. */}
            {loadingMore ? <Loading style={styles.loadingMore} /> : null}
            {/* 서버에 텍스트 검색이 없어 검색은 **불러온 집** 안에서만 걸린다
                (#975). 목록이 아직 남아 있는데 검색 중이면 그 사실을 밝힌다 —
                "없어요"로 보이면 정말 없는 줄 안다. */}
            {query.length > 0 && hasNext ? (
              <Text style={[Typography.supporting, styles.searchScope, { color: t.textMuted }]}>
                지금까지 불러온 집에서 찾은 결과예요. 검색어를 지우고 더 내려보면 집이 더 나와요.
              </Text>
            ) : null}
            <Pressable
              onPress={onCreate}
              accessibilityRole="button"
              style={[styles.createBtn, { borderColor: t.disabledBg }]}>
              <View style={styles.iconLabelRow}>
                <CrownPictogram size={14} />
                <Text style={[Typography.label, { color: t.textMuted }]}>새 집 만들기</Text>
              </View>
            </Pressable>
          </>
        }
      />
      {/* 참여 전 집 미리보기 모달 (#328) — isFull은 참여 비활성, isMember는 안내만. */}
      {housePreview ? (
        <View style={styles.hpOverlay}>
          <Pressable style={styles.hpBackdrop} onPress={() => setHousePreview(null)} />
          <View style={[styles.hpCard, { backgroundColor: t.screen }]}>
            {/* 집 화면과 같은 프레임+창문 비주얼 — 프리뷰 응답의 memberRooms로
                실제 방을 그리고 (#386), 없으면 인원수 목업으로 폴백. */}
            <HousePreviewFrame
              coverImageKey={housePreview.coverImageKey}
              memberCount={housePreview.members}
              rooms={housePreview.rooms}
              furniture={furniture}
              wallpapers={wallpapers}
              floors={floors}
              backgrounds={backgrounds}
              name={housePreview.name}
            />
            <Text style={[Typography.h2, { color: t.text }]} numberOfLines={1}>
              {housePreview.name}
            </Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {housePreview.level != null ? `Lv.${housePreview.level} · ` : ''}멤버{' '}
              {housePreview.members}
              {housePreview.capacity ? ` / ${housePreview.capacity}` : ''}
              {housePreview.isFull ? <Text style={{ color: t.danger }}> · 만석</Text> : null}
            </Text>
            {housePreview.description ? (
              <Text style={[Typography.body, styles.hpDesc, { color: t.text }]}>
                {housePreview.description}
              </Text>
            ) : null}
            {housePreview.goals.length > 0 ? (
              <View style={styles.hpGoals}>
                {housePreview.goals.map((g) => (
                  <View key={g} style={[styles.tag, { backgroundColor: t.surfaceMuted }]}>
                    <Text style={[styles.tagText, emph('bold'), { color: t.onTint }]}>#{g}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {/* 단체미션 미리보기 (#532) — 진행도와 함께 노출. */}
            {housePreview.missions?.length ? (
              <View style={styles.hpMissions}>
                <View style={styles.previewMissionHeading}>
                  <SparklePictogram size={14} />
                  <Text style={[Typography.label, { color: t.text }]}>단체미션 미리보기</Text>
                </View>
                <ScrollView style={styles.previewMissionScroll}>
                  <View style={styles.previewMissionList}>
                    {housePreview.missions.map((mission) => {
                      const progress = Math.min(1, mission.current / mission.target);
                      return (
                        <View
                          key={mission.id}
                          style={[styles.previewMission, { backgroundColor: t.surfaceMuted }]}>
                          <Pictogram name={mission.icon} size={20} />
                          <View style={styles.flex}>
                            <View style={styles.previewMissionHead}>
                              <Text
                                style={[Typography.label, styles.flex, { color: t.text }]}
                                numberOfLines={1}>
                                {mission.title}
                              </Text>
                              <Text style={[Typography.supporting, { color: t.primaryText }]}>
                                {mission.current}/{mission.target}
                                {mission.unit}
                              </Text>
                            </View>
                            <SpringProgressBar
                              progress={progress}
                              color={t.primary}
                              trackColor={t.border}
                              height={6}
                              style={styles.previewMissionTrack}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  입주 후 미션에 참여하고 보상을 받을 수 있어요
                </Text>
              </View>
            ) : null}
            <View style={styles.hpActions}>
              <Pressable
                onPress={() => setHousePreview(null)}
                accessibilityRole="button"
                accessibilityLabel="미리보기 닫기"
                style={[styles.hpBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>닫기</Text>
              </Pressable>
              {housePreview.isMember ? (
                <View style={[styles.hpBtn, { backgroundColor: t.disabledBg }]}>
                  <Text style={[Typography.label, { color: t.textMuted }]}>이미 참여 중</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    if (housePreview.isFull) return toast('정원이 가득 찼어요', 'error');
                    onJoinHouse?.(housePreview.id);
                    setHousePreview(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="이 집에 참여하기"
                  accessibilityState={{ disabled: !!housePreview.isFull }}
                  style={[
                    styles.hpBtn,
                    { backgroundColor: housePreview.isFull ? t.disabledBg : t.primary },
                  ]}>
                  <Text
                    style={[
                      Typography.label,
                      { color: housePreview.isFull ? t.textMuted : t.onPrimary },
                    ]}>
                    참여하기
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      ) : null}
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
  body: { padding: Spacing.four },
  headerBlock: { gap: Spacing.four, marginBottom: Spacing.four },
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
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.half },
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
  msg: { marginLeft: Spacing.one },
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
  listGap: { height: Spacing.two },
  loading: { paddingVertical: Spacing.six },
  loadingMore: { paddingVertical: Spacing.three },
  searchScope: { textAlign: 'center', paddingHorizontal: Spacing.three },
  errorBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  houseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  // 탭 가능한 카드 본문(커버+정보) — 입주 버튼과 분리 (#328).
  houseBody: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  hpOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  hpBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Overlay.dim,
  },
  hpCard: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  hpDesc: {
    marginTop: Spacing.one,
  },
  hpGoals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  hpActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  hpBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
  // 단체미션 미리보기 섹션 래퍼 (#532).
  hpMissions: {
    marginTop: Spacing.one,
    gap: Spacing.one,
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
    marginTop: Spacing.half,
  },
  tag: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  tagText: { fontSize: 12 },
  // flexShrink를 주면 줄바꿈 대신 계속 줄어들며 잘린다 — 온전한 너비로 개행.
  meta: { fontSize: 13 },
  joinBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  createBtn: {
    marginTop: Spacing.four,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  previewMissionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  previewMissionScroll: {
    flexGrow: 0,
    maxHeight: 180,
  },
  previewMissionList: {
    gap: Spacing.two,
  },
  previewMission: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  previewMissionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  previewMissionTrack: {
    marginTop: Spacing.one,
  },
  previewMissionFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  readOnlyHint: {
    textAlign: 'center',
  },
});
