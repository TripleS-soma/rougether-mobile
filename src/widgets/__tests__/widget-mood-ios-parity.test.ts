import fs from 'node:fs';
import path from 'node:path';

import {
  resolveWidgetMood,
  WIDGET_CROWN_STREAK,
  WIDGET_CRYING_DAYS,
  WIDGET_EVENING_HOUR,
  WIDGET_FACE_IMAGES,
  WIDGET_SAD_DAYS,
  type WidgetFace,
} from '@/widgets/widget-mood';

/**
 * iOS 위젯(Swift)과 안드로이드(JS)의 표정 규칙 대조 (#1122). Swift 단위 테스트는 CI가
 * 안 돌리므로, index.swift를 텍스트로 읽어 임계값·문구·얼굴 에셋 이름이 JS 쪽과
 * 같은지 확인한다. 한쪽만 바꾸면 여기서 깨진다.
 */
const swift = fs.readFileSync(path.join(__dirname, '../../../targets/widgets/index.swift'), 'utf8');
const targetConfig = fs.readFileSync(
  path.join(__dirname, '../../../targets/widgets/expo-target.config.js'),
  'utf8',
);

const swiftConst = (name: string) => {
  const m = swift.match(new RegExp(`^let ${name} = (\\d+)$`, 'm'));
  if (!m) throw new Error(`index.swift에 ${name} 상수가 없습니다`);
  return Number(m[1]);
};

describe('iOS 위젯 표정 — JS 규칙과 동일', () => {
  it('임계값 상수가 같다 (저녁 시각·슬픔·울음·왕관)', () => {
    expect(swiftConst('widgetEveningHour')).toBe(WIDGET_EVENING_HOUR);
    expect(swiftConst('widgetSadDays')).toBe(WIDGET_SAD_DAYS);
    expect(swiftConst('widgetCryingDays')).toBe(WIDGET_CRYING_DAYS);
    expect(swiftConst('widgetCrownStreak')).toBe(WIDGET_CROWN_STREAK);
  });

  it('문구 템플릿이 같다 — JS가 만든 문구의 고정 부분이 Swift 소스에 있다', () => {
    const TODAY = '2026-09-08';
    const noon = new Date(2026, 8, 8, 12, 0, 0);
    const evening = new Date(2026, 8, 8, 19, 0, 0);
    const hoursAgo = (h: number, from: Date) =>
      new Date(from.getTime() - h * 3600_000).toISOString();
    const base = { done: 1, total: 3, streak: 2, remaining: ['a', 'b'], date: TODAY };
    const done = { ...base, done: 3, remaining: [] };
    const messages = [
      resolveWidgetMood({
        summary: done,
        todayIso: TODAY,
        now: noon,
        lastActiveAt: hoursAgo(1, noon),
      }),
      resolveWidgetMood({
        summary: { ...done, streak: 7 },
        todayIso: TODAY,
        now: noon,
        lastActiveAt: hoursAgo(1, noon),
      }),
      resolveWidgetMood({
        summary: base,
        todayIso: TODAY,
        now: evening,
        lastActiveAt: hoursAgo(1, evening),
      }),
      resolveWidgetMood({
        summary: base,
        todayIso: TODAY,
        now: noon,
        lastActiveAt: hoursAgo(49, noon),
      }),
      resolveWidgetMood({
        summary: base,
        todayIso: TODAY,
        now: noon,
        lastActiveAt: hoursAgo(121, noon),
      }),
    ].map((m) => m.message ?? '');
    expect(messages.every(Boolean)).toBe(true);
    // 숫자 보간 자리(N일·N개)를 경계로 자른 고정 문구 조각이 Swift 문자열 리터럴에 그대로 있어야 한다.
    for (const message of messages) {
      for (const part of message.split(/\d+/).filter(Boolean)) {
        expect(swift).toContain(part);
      }
    }
  });

  it('얼굴 6종의 에셋이 타깃 설정과 Swift 이름 매핑에 모두 있다', () => {
    const faces = Object.keys(WIDGET_FACE_IMAGES) as WidgetFace[];
    for (const face of faces) {
      const assetName = `face${face[0].toUpperCase()}${face.slice(1)}`;
      expect(targetConfig).toContain(
        `${assetName}: '../../assets/images/widget-faces/${face}.png'`,
      );
      expect(swift).toContain(`case .${face}: return "${assetName}"`);
    }
  });
});
