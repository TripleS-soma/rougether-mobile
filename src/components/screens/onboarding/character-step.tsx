import type { RefObject } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { CharacterAvatar } from '@/components/room/character-avatar';
import { PrimaryButton, TextButton } from '@/components/screens/onboarding/onboarding-buttons';
import { onboardingStyles as styles } from '@/components/screens/onboarding/onboarding-styles';
import { type CharacterId, STARTER_CHARACTER_OPTIONS } from '@/constants/characters';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { i18n, useT } from '@/i18n';

type CharacterOption = (typeof STARTER_CHARACTER_OPTIONS)[number];

export function withRang(name: string): string {
  const code = name.charCodeAt(name.length - 1);
  const hasFinal = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 > 0;
  return `${name}${hasFinal ? '이랑' : '랑'}`;
}

/**
 * 온보딩 캐릭터 선택 (#589) — 풀스크린 카드 캐러셀: 카드 하나당 캐릭터 하나, 다음 카드가
 * 살짝 보이는 피크 + 도트로 스와이프를 암시한다. 활성 카드만 wave(CDN webp)를 재생한다.
 * 상태·스크롤 ref·카드 지오메트리는 부모가 갖는다(리팩토링 장부 25번).
 */
export function CharacterStep({
  screenStyle,
  characterOrder,
  selectedCharacter,
  onSelect,
  characterFrames,
  scrollRef,
  webSettleRef,
  geometry: { cardW, cardGap, sidePad, snap },
  jumpTo,
  onNext,
  onPrevious,
}: {
  screenStyle: StyleProp<ViewStyle>;
  characterOrder: readonly CharacterOption[];
  selectedCharacter: CharacterId;
  onSelect: (id: CharacterId) => void;
  characterFrames?: Partial<Record<CharacterId, string[]>>;
  scrollRef: RefObject<ScrollView | null>;
  /** RN-web은 momentum-end가 없어 스크롤 유휴로 정착시킨다 — 그 타이머. */
  webSettleRef: RefObject<ReturnType<typeof setTimeout> | null>;
  geometry: { cardW: number; cardGap: number; sidePad: number; snap: number };
  jumpTo: (x: number, animated: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const activeIndex = Math.max(
    0,
    characterOrder.findIndex((c) => c.id === selectedCharacter),
  );
  const active = characterOrder[activeIndex];
  const settleAt = (x: number) => {
    const i = Math.min(characterOrder.length - 1, Math.max(0, Math.round(x / snap)));
    const opt = characterOrder[i];
    if (opt) onSelect(opt.id);
  };
  const focusCharacter = (i: number) => {
    const opt = characterOrder[i];
    if (!opt) return;
    onSelect(opt.id);
    jumpTo(i * snap, true);
  };
  return (
    <View style={[styles.screen, screenStyle]}>
      <View style={styles.intro}>
        <Text style={[Typography.h1, { color: t.text }]}>
          {tr('member.onboarding.characterTitle')}
        </Text>
        <Text style={[Typography.supporting, styles.introBody, { color: t.textMuted }]}>
          {tr('member.onboarding.characterBody')}
        </Text>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        style={styles.flex}
        showsHorizontalScrollIndicator={false}
        snapToInterval={snap}
        decelerationRate="fast"
        contentContainerStyle={[styles.characterRail, { paddingHorizontal: sidePad, gap: cardGap }]}
        onMomentumScrollEnd={(e) => settleAt(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
        onScroll={
          Platform.OS === 'web'
            ? (e) => {
                const x = e.nativeEvent.contentOffset.x;
                if (webSettleRef.current) clearTimeout(webSettleRef.current);
                webSettleRef.current = setTimeout(() => settleAt(x), 160);
              }
            : undefined
        }
        testID="character-carousel">
        {characterOrder.map((c, i) => {
          const isActive = selectedCharacter === c.id;
          const frames = characterFrames?.[c.id];
          return (
            <Pressable
              key={c.id}
              onPress={() => focusCharacter(i)}
              accessibilityRole="radio"
              accessibilityLabel={`${c.name}. ${c.description}`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.characterSlide,
                { width: cardW, backgroundColor: t.surface },
                { borderColor: isActive ? t.primary : t.border },
              ]}>
              <View style={[styles.characterStage, { backgroundColor: c.bg }]}>
                <CharacterAvatar
                  characterId={c.id}
                  size={Math.min(Math.round(cardW * 0.55), 220)}
                  // 활성 카드만 서버 프레임을 넘긴다 — CharacterAvatar는 유효한
                  // CDN 키가 있으면 그 webp를, 없으면 번들 정적 포즈를 그린다.
                  frames={isActive ? frames : undefined}
                />
              </View>
              <View style={styles.characterMeta}>
                <Text style={[Typography.h2, { color: t.text }]}>{c.name}</Text>
                <Text
                  style={[Typography.body, styles.center, { color: t.textMuted }]}
                  numberOfLines={2}>
                  {c.description}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.dots}>
        {characterOrder.map((c, i) => (
          <Pressable
            key={c.id}
            onPress={() => focusCharacter(i)}
            accessibilityRole="button"
            accessibilityLabel={tr('member.onboarding.goToCard', { name: c.name })}
            style={[
              styles.dot,
              i === activeIndex
                ? { width: 24, backgroundColor: t.primary }
                : { width: 8, backgroundColor: t.border },
            ]}
          />
        ))}
      </View>
      <View style={styles.actions}>
        <PrimaryButton
          // 한국어만 '이랑/랑' 조사 — 다른 언어는 이름 그대로 (#893).
          label={tr('member.onboarding.goWith', {
            name: i18n.language === 'ko' ? withRang(active.name) : active.name,
          })}
          onPress={onNext}
        />
        <TextButton label={tr('member.common.previous')} onPress={onPrevious} />
      </View>
    </View>
  );
}
