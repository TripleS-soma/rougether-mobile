import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CharacterAvatar } from '@/components/room/character-avatar';
import { Field } from '@/components/ui/field';
import { ActionBar } from '@/components/ui/action-bar';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { BIO_MAX, NICKNAME_MAX } from '@/constants/profile';
import { Radius, Spacing } from '@/constants/theme';
import { useActionBarInset, useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type ProfileEditScreenProps = {
  initialNickname?: string;
  initialBio?: string;
  characterId?: CharacterId;
  onSave?: (nickname: string, bio: string) => void;
  onBack?: () => void;
};

/**
 * "프로필 편집" screen reached from 설정 → 프로필 편집. Edits nickname + one-line
 * bio over the current character avatar. Pure/prop-driven; persistence is wired
 * by the app shell via onSave.
 */
export function ProfileEditScreen({
  initialNickname = '',
  initialBio = '',
  characterId = DEFAULT_CHARACTER_ID,
  onSave,
  onBack,
}: ProfileEditScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  const actionBarInset = useActionBarInset();
  const Typography = useTypography();
  const [nickname, setNickname] = useState(initialNickname);
  const [bio, setBio] = useState(initialBio);
  const character = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];

  const trimmed = nickname.trim();
  const canSave = trimmed.length > 0;

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="프로필 편집" onBack={onBack} />

      {/* 저장 버튼이 ScrollView 밖 하단 고정이라 키보드에 덮인다 (#923).
          persistTaps="handled" 는 배경 탭에 키보드를 내리면서 버튼 탭은
          한 번에 먹는다 — 기본값(never)이면 탭이 자식에게 안 간다. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.body,
            column,
            headerInset ? { paddingTop: headerInset } : null,
            actionBarInset ? { paddingBottom: actionBarInset } : null,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: character.bg }]}>
              <CharacterAvatar characterId={characterId} size={88} />
            </View>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              캐릭터는 나의 방에서 바꿀 수 있어요.
            </Text>
          </View>

          <View style={styles.form}>
            <Field
              label="닉네임"
              value={nickname}
              onChangeText={setNickname}
              placeholder="닉네임을 입력해주세요"
              maxLength={NICKNAME_MAX}
            />
            <Field
              label="한 줄 소개"
              value={bio}
              onChangeText={setBio}
              placeholder="나를 한 줄로 소개해보세요"
              maxLength={BIO_MAX}
            />
          </View>
        </ScrollView>

        {/* 저장 버튼은 떠 있는 액션 바 (#1069) — 글래스면 콘텐츠 위에 뜨고, 아니면 종전 바. */}
        <ActionBar style={styles.footer}>
          <Pressable
            onPress={() => canSave && onSave?.(trimmed, bio.trim())}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="프로필 저장"
            style={styles.save}>
            <GlassSurface
              style={styles.saveFace}
              tintColor={canSave ? t.primary : undefined}
              fallbackColor={canSave ? t.primary : t.surfaceMuted}>
              <Text style={[Typography.label, { color: canSave ? t.onPrimary : t.textMuted }]}>
                저장
              </Text>
            </GlassSurface>
          </Pressable>
        </ActionBar>
      </KeyboardAvoidingView>
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
  body: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  avatarWrap: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: Spacing.three,
  },
  footer: {
    padding: Spacing.four,
    borderTopWidth: 1,
  },
  save: {
    borderRadius: Radius.pill,
  },
  saveFace: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
