import { Image } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/components/ui/toast';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

/** 스크린샷 첨부 한도 — 서버 계약(최대 3장, png·jpeg·webp 각 10MB). */
export const MAX_BUG_REPORT_IMAGES = 3;

/**
 * 내용 최대 길이 — 서버 계약 2000자. 쿼리 파라미터 전송 시절의 600자
 * 클램프(Tomcat URL 한도)는 #567에서 multipart 폼 필드 전환으로 해제.
 */
export const MAX_BUG_REPORT_CONTENT = 2000;

export type BugReportStatus = 'RECEIVED' | 'IN_PROGRESS' | 'RESOLVED';

/** View model of one submitted report (GET /me/bug-reports). */
export type BugReportEntry = {
  id: number;
  title: string;
  status: BugReportStatus;
  /** "M월 D일" — 제출일. */
  date: string;
  /**
   * 첨부 스크린샷 키 (#736). 비공개 리소스라 주소만으로는 못 그린다 —
   * 화면이 `onLoadScreenshot`으로 바이트를 받아 data URI로 띄운다.
   */
  screenshotKeys?: string[];
};

const STATUS_LABEL: Record<BugReportStatus, string> = {
  RECEIVED: '접수됨',
  IN_PROGRESS: '처리 중',
  RESOLVED: '해결됨',
};

export type BugReportImageInput = { uri: string; name: string; type: string };

export type BugReportScreenProps = {
  /** 내 제보 내역 (최신순). */
  entries?: BugReportEntry[];
  /** Submit the form; resolve true on success (the shell refreshes entries). */
  onSubmit?: (input: {
    title: string;
    content: string;
    images: BugReportImageInput[];
  }) => Promise<boolean>;
  /** Open the photo library; resolve the picked image or null on cancel. */
  onPickImage?: () => Promise<BugReportImageInput | null>;
  /**
   * 첨부 스크린샷 한 장을 불러온다 (#736) — 비공개 리소스라 주소만으로는 못
   * 그리고 인증 헤더가 필요하다. 셸이 바이트를 받아 data URI로 준다.
   * 생략하면 썸네일을 아예 안 그린다(데모·갤러리).
   */
  onLoadScreenshot?: (key: string) => Promise<string | null>;
  onBack?: () => void;
};

/**
 * 설정 → 버그 제보 (#496): 제보 폼(제목·내용·스크린샷 최대 3장) 위, 내 제보
 * 내역(상태 배지) 아래 한 화면. Pure/prop-driven — 서버 호출은 셸의 훅이 담당.
 */
export function BugReportScreen({
  entries = [],
  onSubmit,
  onPickImage,
  onLoadScreenshot,
  onBack,
}: BugReportScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const { show: toast } = useToast();
  /** 크게 보는 중인 첨부 (#736) — null이면 뷰어를 안 띄운다. */
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<BugReportImageInput[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !submitting;

  const addImage = async () => {
    if (images.length >= MAX_BUG_REPORT_IMAGES || !onPickImage) return;
    const picked = await onPickImage();
    if (picked) setImages((prev) => [...prev, picked]);
  };

  const submit = async () => {
    if (submitting) return;
    if (!canSubmit) {
      toast('제목과 내용을 입력해주세요', 'error');
      return;
    }
    setSubmitting(true);
    const ok = onSubmit
      ? await onSubmit({ title: title.trim(), content: content.trim(), images })
      : true;
    setSubmitting(false);
    if (ok) {
      setTitle('');
      setContent('');
      setImages([]);
      toast('제보가 접수됐어요. 소중한 의견 감사해요!');
    } else {
      toast('제보 접수에 실패했어요. 잠시 후 다시 시도해 주세요.', 'error');
    }
  };

  const badgeColors = (status: BugReportStatus) => {
    if (status === 'RESOLVED') return { bg: t.primarySoft, fg: t.primaryText };
    if (status === 'IN_PROGRESS') return { bg: t.warningSoft, fg: t.warningText };
    return { bg: t.surfaceMuted, fg: t.textMuted };
  };

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="버그 제보" onBack={onBack} />

      <ScrollView contentContainerStyle={[styles.body, column]} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <Field
            label="제목"
            placeholder="어떤 문제가 있었나요?"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <View style={styles.contentWrap}>
            <Text style={[styles.contentLabel, emph('semibold'), { color: t.textMuted }]}>
              내용
            </Text>
            <TextInput
              style={[styles.contentInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
              placeholder="발생 상황을 자세히 적어주시면 해결에 큰 도움이 돼요"
              placeholderTextColor={t.textMuted}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              maxLength={MAX_BUG_REPORT_CONTENT}
            />
          </View>

          <View style={styles.shots}>
            {images.map((img, idx) => (
              <View key={`${img.uri}-${idx}`} style={styles.shot}>
                <Image source={{ uri: img.uri }} style={styles.shotImg} contentFit="cover" />
                <Pressable
                  style={[styles.shotRemove, { backgroundColor: t.text }]}
                  hitSlop={8}
                  onPress={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                  accessibilityRole="button"
                  accessibilityLabel={`스크린샷 ${idx + 1} 삭제`}>
                  <Icon name="close" size={12} color={t.surface} />
                </Pressable>
              </View>
            ))}
            {images.length < MAX_BUG_REPORT_IMAGES && onPickImage ? (
              <Pressable
                style={[styles.shotAdd, { borderColor: t.border }]}
                onPress={addImage}
                accessibilityRole="button"
                accessibilityLabel="스크린샷 추가">
                <Icon name="camera" size={20} color={t.textMuted} />
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  {images.length}/{MAX_BUG_REPORT_IMAGES}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            disabled={submitting}
            onPress={submit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: canSubmit ? t.primary : t.disabledBg },
              pressed && canSubmit && { backgroundColor: t.primaryActive },
            ]}>
            <Text
              style={[
                Typography.body,
                emph('semibold'),
                { color: canSubmit ? t.onPrimary : t.textMuted },
              ]}>
              {submitting ? '접수 중…' : '제출하기'}
            </Text>
          </Pressable>
        </View>

        <Text
          style={[Typography.label, emph('semibold'), styles.sectionTitle, { color: t.textMuted }]}>
          내 제보 내역
        </Text>
        <View style={[styles.card, styles.listCard, { backgroundColor: t.surface }]}>
          {entries.length === 0 ? (
            <Text style={[Typography.supporting, styles.empty, { color: t.textMuted }]}>
              아직 제보한 내용이 없어요
            </Text>
          ) : (
            entries.map((e, idx) => {
              const badge = badgeColors(e.status);
              return (
                <View
                  // 서버가 bugReportId를 빠뜨리면 id가 0으로 겹칠 수 있어 idx를 섞는다.
                  key={`${e.id}-${idx}`}
                  style={[
                    styles.entryRow,
                    idx !== entries.length - 1 && {
                      borderBottomColor: t.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}>
                  <View style={styles.entryText}>
                    <Text style={[Typography.body, { color: t.text }]} numberOfLines={1}>
                      {e.title}
                    </Text>
                    {e.date ? (
                      <Text style={[Typography.supporting, { color: t.textMuted }]}>{e.date}</Text>
                    ) : null}
                    {/* 첨부 스크린샷 (#736) — 지금까지 제보 후 다시 볼 방법이 없었다. */}
                    {onLoadScreenshot && e.screenshotKeys?.length ? (
                      <EntryScreenshots
                        keys={e.screenshotKeys}
                        load={onLoadScreenshot}
                        onOpen={setViewerUri}
                      />
                    ) : null}
                  </View>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[Typography.supporting, emph('semibold'), { color: badge.fg }]}>
                      {STATUS_LABEL[e.status]}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
      {/* 첨부 크게 보기 (#736) — 배경을 누르면 닫힌다. */}
      <Modal
        visible={viewerUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}>
        <Pressable
          onPress={() => setViewerUri(null)}
          accessibilityRole="button"
          accessibilityLabel="첨부 닫기"
          style={[styles.viewerBackdrop, { backgroundColor: Overlay.strong }]}>
          {viewerUri ? (
            <Image source={{ uri: viewerUri }} style={styles.viewerImage} contentFit="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * 제보 한 건의 첨부 썸네일 (#736). 비공개 리소스라 키만으로는 못 그린다 —
 * 마운트될 때 한 장씩 받아 data URI로 바꿔 띄운다.
 *
 * memo 경계: 내역이 길어지면 행마다 이미지를 들고 있으므로, 부모 리렌더가
 * 로딩을 다시 돌리지 않게 끊는다.
 */
const EntryScreenshots = memo(function EntryScreenshots({
  keys,
  load,
  onOpen,
}: {
  keys: string[];
  load: (key: string) => Promise<string | null>;
  onOpen: (uri: string) => void;
}) {
  const [uris, setUris] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    for (const key of keys) {
      void load(key).then((uri) => {
        // 화면을 떠난 뒤 도착한 응답은 버린다.
        if (alive && uri) setUris((prev) => ({ ...prev, [key]: uri }));
      });
    }
    return () => {
      alive = false;
    };
    // keys는 배열이라 참조가 매번 새로울 수 있어 내용으로 고정한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join('|'), load]);

  const loaded = keys.filter((k) => uris[k]);
  if (loaded.length === 0) return null;
  return (
    <View style={styles.shotRow}>
      {loaded.map((key) => (
        <Pressable
          key={key}
          onPress={() => onOpen(uris[key])}
          accessibilityRole="button"
          accessibilityLabel="첨부 스크린샷 크게 보기"
          testID={`bug-shot-${key}`}>
          <Image source={{ uri: uris[key] }} style={styles.shotThumb} contentFit="cover" />
        </Pressable>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  contentWrap: {
    gap: Spacing.one,
  },
  contentLabel: {
    fontSize: 15,
  },
  contentInput: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 120,
    fontSize: 17,
  },
  shots: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  shot: {
    width: 64,
    height: 64,
  },
  shotImg: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.md,
  },
  shotRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotAdd: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  submit: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  sectionTitle: {
    marginTop: Spacing.two,
    marginLeft: Spacing.one,
  },
  listCard: {
    gap: 0,
    paddingVertical: 0,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  entryText: {
    flex: 1,
    gap: Spacing.half,
  },
  shotRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  shotThumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
  },
  viewerBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  viewerImage: {
    width: '100%',
    height: '80%',
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
});
