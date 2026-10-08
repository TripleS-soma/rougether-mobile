import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { CharacterAvatar } from '@/components/room/character-avatar';
import { PrimaryButton, TextButton } from '@/components/screens/onboarding/onboarding-buttons';
import { onboardingStyles as styles } from '@/components/screens/onboarding/onboarding-styles';
import type { CharacterId } from '@/constants/characters';
import { NICKNAME_MAX } from '@/constants/profile';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/**
 * 온보딩 닉네임 단계 (#635) — 캐릭터 다음, 시작 직전. 서버 닉네임이 비어 데모 기본값이
 * 노출되던 신규 계정 문제의 근본 해결이라 필수 입력. 상태는 부모(onboarding-screen)가
 * 갖고 이 화면은 그리기만 한다(리팩토링 장부 25번).
 */
export function NicknameStep({
  screenStyle,
  androidKeyboard,
  characterId,
  characterName,
  characterFrames,
  nickname,
  onChangeNickname,
  onStart,
  onPrevious,
}: {
  screenStyle: StyleProp<ViewStyle>;
  /** 안드로이드 키보드 높이 (#1326) — 부모가 이 단계에서만 듣는다. */
  androidKeyboard: number;
  characterId: CharacterId;
  characterName: string;
  characterFrames?: string[];
  nickname: string;
  onChangeNickname: (value: string) => void;
  /** 다듬은 닉네임으로 시작. */
  onStart: (trimmed: string) => void;
  onPrevious: () => void;
}) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const trimmed = nickname.trim();
  const canStart = trimmed.length > 0;
  return (
    <View style={[styles.screen, screenStyle]}>
      {/* 이 단계만 ScrollView가 아니라 고정 레이아웃이라, 다른 입력 화면이
            쓰는 keyboardShouldPersistTaps가 통하지 않는다 (#923). 키보드를
            내리는 배경 탭은 Pressable로 직접 걸고, autoFocus로 곧장 올라온
            키보드가 '시작하기'를 덮지 않게 KeyboardAvoidingView로 감싼다.
            안드로이드는 엣지투엣지라 KAV의 behavior가 전부 무력해(#1326 — 입력칸이
            키보드에 가려진 채 그대로) 키보드 높이만큼 아래 여백을 직접 준다(#1290). */}
      <KeyboardAvoidingView
        style={[styles.flex, Platform.OS === 'android' && { paddingBottom: androidKeyboard }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        testID="onboarding-nickname-keyboard">
        <View style={styles.intro}>
          <Text style={[Typography.h1, { color: t.text }]}>
            {tr('member.onboarding.nicknameTitle')}
          </Text>
          <Text style={[Typography.supporting, styles.introBody, { color: t.textMuted }]}>
            {tr('member.onboarding.nicknameBody', { name: characterName })}
          </Text>
        </View>
        {/* accessible={false} — 배경을 스크린리더 대상으로 만들지 않는다. */}
        <Pressable style={styles.nicknameBody} onPress={Keyboard.dismiss} accessible={false}>
          <CharacterAvatar characterId={characterId} frames={characterFrames} size={120} />
          <TextInput
            value={nickname}
            onChangeText={(v) => onChangeNickname(v.slice(0, NICKNAME_MAX))}
            placeholder={tr('member.onboarding.nicknamePlaceholder', { max: NICKNAME_MAX })}
            placeholderTextColor={t.textDisabled}
            autoFocus
            autoCorrect={false}
            maxLength={NICKNAME_MAX}
            accessibilityLabel={tr('member.onboarding.nicknameInputA11y')}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            style={[
              styles.nicknameInput,
              Typography.h3,
              { backgroundColor: t.surface, color: t.text, borderColor: t.border },
            ]}
          />
        </Pressable>
        <View style={styles.actions}>
          <PrimaryButton
            label={tr('member.common.start')}
            disabled={!canStart}
            blockedMessage={tr('member.onboarding.nicknameRequired')}
            onPress={() => onStart(trimmed)}
          />
          <TextButton label={tr('member.common.previous')} onPress={onPrevious} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
