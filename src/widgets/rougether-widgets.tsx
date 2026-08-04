'use no memo';
// React Compiler 제외 (#604 후속) — 위젯 트리는 React 렌더러 없이
// 라이브러리가 함수 호출로 평가한다. 컴파일러가 주입하는 useMemoCache가
// 널 디스패처에서 터져 위젯이 투명하게 비던 버그의 수정.

/**
 * 안드로이드 홈 위젯 2종 (#604, 시안 B·D) — RemoteViews 위에서 도는
 * react-native-android-widget 트리라 앱 컴포넌트·훅을 쓸 수 없다.
 * 색은 cozy 토큰 실값(Themes/DarkThemes)을 직접 읽고, 폰트는 시스템,
 * 배치는 FlexWidget 플렉스만 사용한다(절대배치 없음 — 내 방 위젯의
 * 진행 필은 이미지 아래 바 행으로 배치).
 */
import React from 'react';
import { Appearance } from 'react-native';
import {
  FlexWidget,
  ImageWidget,
  TextWidget,
  type WidgetTaskHandlerProps,
} from 'react-native-android-widget';

import { DarkThemes, Themes } from '@/constants/theme';
import { loadWidgetRoomImage, loadWidgetSummary, type WidgetSummary } from '@/widgets/widget-data';

const EMPTY_SUMMARY: WidgetSummary = { done: 0, total: 0, streak: 0, remaining: [] };

type Palette = (typeof Themes)['cozy'];

const palette = (dark: boolean): Palette => (dark ? DarkThemes.cozy : Themes.cozy);

/**
 * 시안 B — 오늘 리스트 (2×2, #688): 진행 바 + 남은 루틴 제목. 좁은 셀에
 * 맞춘 컴팩트 헤더(라벨 생략)이고, 제목은 flex:1 폭 제약 위에서 truncate가
 * 실제로 동작한다(제약 없이는 긴 제목이 레이아웃을 밀어냈다).
 */
export function TodayListWidget({ summary, dark }: { summary: WidgetSummary; dark: boolean }) {
  const t = palette(dark);
  const progress = summary.total > 0 ? summary.done / summary.total : 0;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: t.surface as `#${string}`,
        borderRadius: 20,
        padding: 11,
        flexDirection: 'column',
      }}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text="🐾" style={{ fontSize: 12 }} />
        <FlexWidget style={{ flex: 1 }} />
        {summary.streak > 0 ? (
          <TextWidget
            text={`🔥${summary.streak}  `}
            style={{ fontSize: 11, fontWeight: '700', color: t.warningText as `#${string}` }}
          />
        ) : null}
        <TextWidget
          text={`${summary.done}/${summary.total}`}
          style={{ fontSize: 13, fontWeight: '700', color: t.primaryText as `#${string}` }}
        />
      </FlexWidget>
      <FlexWidget style={{ height: 6 }} />
      {/* 진행 바 — flex 비율로 채운다(퍼센트 폭 미지원). */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          height: 6,
          backgroundColor: t.surfaceMuted as `#${string}`,
          borderRadius: 99,
        }}>
        <FlexWidget
          style={{
            flex: Math.round(progress * 100),
            height: 6,
            backgroundColor: t.primary as `#${string}`,
            borderRadius: 99,
          }}
        />
        <FlexWidget style={{ flex: Math.round((1 - progress) * 100), height: 6 }} />
      </FlexWidget>
      <FlexWidget style={{ height: 4 }} />
      {summary.total === 0 ? (
        <TextWidget
          text="오늘 예정된 루틴이 없어요"
          truncate="END"
          maxLines={2}
          style={{ fontSize: 12, color: t.textMuted as `#${string}` }}
        />
      ) : summary.remaining.length === 0 ? (
        <TextWidget
          text="모두 완료했어요! 🎉"
          truncate="END"
          maxLines={2}
          style={{ fontSize: 12, fontWeight: '700', color: t.primaryText as `#${string}` }}
        />
      ) : (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
          {summary.remaining.map((title, i) => (
            <FlexWidget
              key={`r-${i}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 2,
                width: 'match_parent',
              }}>
              <TextWidget
                text="○ "
                style={{ fontSize: 12, color: t.textDisabled as `#${string}` }}
              />
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text={title}
                  truncate="END"
                  maxLines={1}
                  style={{ fontSize: 12, color: t.text as `#${string}`, width: 'match_parent' }}
                />
              </FlexWidget>
            </FlexWidget>
          ))}
          {summary.total - summary.done > summary.remaining.length ? (
            <TextWidget
              text={`+${summary.total - summary.done - summary.remaining.length}개 더`}
              style={{ fontSize: 11, color: t.textMuted as `#${string}`, paddingTop: 2 }}
            />
          ) : null}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

/** 시안 D — 내 방 (정방형): 방 캡처 + 아래 진행 바 행. */
export function MyRoomWidget({
  summary,
  roomImage,
  dark,
}: {
  summary: WidgetSummary;
  roomImage: string | null;
  dark: boolean;
}) {
  const t = palette(dark);
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: t.surface as `#${string}`,
        borderRadius: 20,
        flexDirection: 'column',
      }}>
      {roomImage ? (
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <ImageWidget
            image={roomImage as `data:image${string}`}
            imageWidth={512}
            imageHeight={512}
            style={{ width: 'match_parent', height: 'match_parent' }}
            radius={20}
          />
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.surfaceMuted as `#${string}`,
            borderRadius: 20,
          }}>
          <TextWidget text="🐾" style={{ fontSize: 28 }} />
          <TextWidget
            text="앱을 열면 내 방이 여기 걸려요"
            style={{ fontSize: 11, color: t.textMuted as `#${string}`, paddingTop: 4 }}
          />
        </FlexWidget>
      )}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 'match_parent',
          paddingHorizontal: 12,
          paddingVertical: 7,
        }}>
        <TextWidget
          text={`🐾 ${summary.done}/${summary.total}`}
          style={{ fontSize: 12, fontWeight: '700', color: t.primaryText as `#${string}` }}
        />
        <FlexWidget style={{ flex: 1 }} />
        {summary.streak > 0 ? (
          <TextWidget
            text={`🔥 ${summary.streak}일`}
            style={{ fontSize: 12, fontWeight: '700', color: t.warningText as `#${string}` }}
          />
        ) : null}
      </FlexWidget>
    </FlexWidget>
  );
}

/** 이름별 위젯 트리 — 태스크 핸들러와 즉시 갱신이 공유한다. */
async function buildWidget(widgetName: string): Promise<React.JSX.Element> {
  const dark = Appearance.getColorScheme() === 'dark';
  const summary = (await loadWidgetSummary()) ?? EMPTY_SUMMARY;
  if (widgetName === 'RougetherRoom') {
    const roomImage = await loadWidgetRoomImage();
    return <MyRoomWidget summary={summary} roomImage={roomImage} dark={dark} />;
  }
  return <TodayListWidget summary={summary} dark={dark} />;
}

/** 위젯 태스크 핸들러 — 추가/주기 갱신/리사이즈 등 시스템 이벤트에 렌더. */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  props.renderWidget(await buildWidget(props.widgetInfo.widgetName));
}

/**
 * 앱 안의 변화(완료 토글·방 꾸미기)를 위젯에 즉시 반영. 안드로이드 전용 —
 * 그 외 플랫폼/모듈 부재(웹 하니스)는 no-op.
 */
export function refreshWidgets(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestWidgetUpdate } = require('react-native-android-widget') as {
      requestWidgetUpdate: (opts: {
        widgetName: string;
        renderWidget: () => Promise<React.JSX.Element>;
        widgetNotFound?: () => void;
      }) => Promise<void>;
    };
    for (const widgetName of ['RougetherToday', 'RougetherRoom']) {
      void requestWidgetUpdate({
        widgetName,
        renderWidget: () => buildWidget(widgetName),
      }).catch(() => {});
    }
  } catch {
    // no-op — 위젯 미지원 환경.
  }
}
