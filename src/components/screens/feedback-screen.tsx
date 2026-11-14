import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppTextInput } from '@/components/ui/app-text-input';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { formatDate, toKstDate } from '@/utils/datetime';
import type { FeedbackEntry, SuggestionInput } from '@/api/feedback';

export type FeedbackScreenProps = {
  kind: 'suggestions' | 'updates';
  entries?: FeedbackEntry[];
  loading?: boolean;
  error?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onRetry?: () => void;
  onMore?: () => void;
  onSubmit?: (input: SuggestionInput) => Promise<void>;
  onBack?: () => void;
};

/** 내 정보의 건의 작성/내역과 관리자 게시 업데이트. 데이터는 부모에서 전달한다. */
export function FeedbackScreen({
  kind,
  entries = [],
  loading,
  error,
  hasMore,
  loadingMore,
  onRetry,
  onMore,
  onSubmit,
  onBack,
}: FeedbackScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const screenStyle = useScreenStyle([]);
  const inset = useHeaderContentInset();
  const column = useResponsiveColumn();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const pending = useRef(false);
  const isSuggestion = kind === 'suggestions';
  const submit = async () => {
    if (pending.current || !onSubmit || !title.trim() || !content.trim()) return;
    pending.current = true;
    setSubmitting(true);
    setResult(null);
    try {
      await onSubmit({ title: title.trim(), content: content.trim() });
      setTitle('');
      setContent('');
      setResult('success');
    } catch {
      setResult('error');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={[styles.screen, screenStyle]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title={tr(isSuggestion ? 'member.myPage.suggestions' : 'member.myPage.updates')}
        onBack={onBack}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.body, column, { paddingTop: inset || Spacing.three }]}>
        {isSuggestion ? (
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <AppTextInput
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              editable={!submitting}
              accessibilityLabel={tr('member.feedback.title')}
              placeholder={tr('member.feedback.title')}
              placeholderTextColor={t.textMuted}
              style={[Typography.label, styles.title, { color: t.text }]}
            />
            <AppTextInput
              value={content}
              onChangeText={setContent}
              maxLength={2000}
              editable={!submitting}
              multiline
              textAlignVertical="top"
              accessibilityLabel={tr('member.feedback.content')}
              placeholder={tr('member.feedback.placeholder')}
              placeholderTextColor={t.textMuted}
              style={[Typography.body, styles.input, { color: t.text }]}
            />
            <Text style={[Typography.caption, styles.counter, { color: t.textMuted }]}>
              {content.length}/2000
            </Text>
            <Button
              label={tr(submitting ? 'member.feedback.sending' : 'member.feedback.send')}
              onPress={() => {
                void submit();
              }}
              disabled={submitting || !onSubmit || !title.trim() || !content.trim()}
            />
            {result ? (
              <Text
                accessibilityRole="alert"
                style={[
                  Typography.supporting,
                  { color: result === 'error' ? t.danger : t.primaryText },
                ]}>
                {tr(
                  result === 'error' ? 'member.feedback.submitFailed' : 'member.feedback.submitted',
                )}
              </Text>
            ) : null}
          </View>
        ) : null}
        {isSuggestion ? (
          <Text style={[Typography.label, { color: t.text }]}>
            {tr('member.feedback.mySuggestions')}
          </Text>
        ) : null}
        {loading ? (
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {tr('member.feedback.loading')}
          </Text>
        ) : null}
        {error ? (
          <View style={styles.status}>
            <Text accessibilityRole="alert" style={[Typography.supporting, { color: t.danger }]}>
              {tr('member.feedback.loadFailed')}
            </Text>
            <Button label={tr('member.feedback.retry')} onPress={onRetry} variant="secondary" />
          </View>
        ) : null}
        {!loading && !error && entries.length === 0 ? (
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <Text style={[Typography.body, { color: t.textMuted }]}>
              {tr(isSuggestion ? 'member.feedback.noSuggestions' : 'member.feedback.noUpdates')}
            </Text>
          </View>
        ) : null}
        {entries.map((entry) => (
          <View key={entry.id} style={[styles.card, { backgroundColor: t.surface }]}>
            <Text style={[Typography.caption, { color: t.textMuted }]}>
              {formatDate(toKstDate(new Date(entry.createdAt)))}
            </Text>
            <Text style={[Typography.label, { color: t.text }]}>{entry.title}</Text>
            <Text style={[Typography.body, { color: t.text }]}>{entry.content}</Text>
          </View>
        ))}
        {hasMore ? (
          <Button
            label={tr(loadingMore ? 'member.feedback.loading' : 'member.feedback.more')}
            onPress={onMore}
            disabled={loadingMore}
            variant="secondary"
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Radius.lg, gap: Spacing.two },
  title: { paddingVertical: Spacing.two },
  input: { minHeight: Spacing.six * 4, paddingVertical: Spacing.two },
  counter: { textAlign: 'right' },
  status: { gap: Spacing.two },
});
