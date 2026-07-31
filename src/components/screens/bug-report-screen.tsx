import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/components/ui/toast';
import { Radius, Spacing } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

/** 스크린샷 첨부 한도 — 서버 계약(최대 3장, png·jpeg·webp 각 10MB). */
export const MAX_BUG_REPORT_IMAGES = 3;

/**
 * 내용 최대 길이. 서버 계약은 2000자지만 title/content가 쿼리 파라미터로
 * 전송되는 구조라 URL 길이 한도에 걸린다 — 실서버 실측(2026-07-27) 결과
 * 한글(percent-encoding 9배) 기준 ~850자부터 Tomcat 400. 한글 제목 100자를
 * 더해도 안전한 600자로 클램프한다. 서버가 content를 multipart 파트로 받게
 * 되면 2000으로 되돌릴 것.
 */
export const MAX_BUG_REPORT_CONTENT = 600;

export type BugReportStatus = 'RECEIVED' | 'IN_PROGRESS' | 'RESOLVED';

/** View model of one submitted report (GET /me/bug-reports). */
export type BugReportEntry = {
  id: number;
  title: string;
  status: BugReportStatus;
  /** "M월 D일" — 제출일. */
  date: string;
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
  onBack,
}: BugReportScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const { show: toast } = useToast();

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
    <View style={[styles.screen, useScreenStyle()]}>
      <ScreenHeader title="버그 제보" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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
    </View>
  );
}

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
    gap: 2,
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
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
});
