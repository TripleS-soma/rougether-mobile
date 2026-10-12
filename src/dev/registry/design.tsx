import { useState } from 'react';
import { Text, View } from 'react-native';
import { LinkifiedText } from '@/components/ui/linkified-text';
import { ListRow } from '@/components/ui/list-row';
import { Badge } from '@/components/ui/badge';
import { CoinIcon } from '@/components/ui/coin-icon';
import { BearCheck } from '@/components/ui/bear-check';
import { GlassSurface } from '@/components/ui/glass-surface';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { CATEGORY_ICON_GEOMETRY, CategoryIcon } from '@/components/ui/category-icon';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CoachMarkOverlay } from '@/components/ui/coach-mark';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Loading } from '@/components/ui/loading';
import { Pill } from '@/components/ui/pill';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SpringProgressBar } from '@/components/ui/spring-progress';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ModalCard } from '@/components/ui/modal-card';
import { ReportSheet } from '@/components/ui/report-sheet';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { MissionBanner } from '@/components/ui/mission-banner';
import { NotificationBanner } from '@/components/ui/notification-banner';
import { PendingNotice } from '@/components/ui/pending-notice';
import { RetryState } from '@/components/ui/retry-state';
import { AppErrorFallback } from '@/components/app/app-error-boundary';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { WheelPicker } from '@/components/ui/wheel-picker';
import { TokenSwatches } from '@/dev/token-swatches';
import { TypeScalePreview } from '@/dev/type-scale-preview';
import { NavigationPreview } from '@/dev/navigation-preview';
import type { GalleryEntry } from '@/dev/registry/types';

/** 달력 주 접힘 데모 (#1327) — 접기/펼치기 토글과 주 이동을 독립적으로 본다. */
function CalendarWeekDemo() {
  const [date, setDate] = useState('2026-09-16');
  const [collapsed, setCollapsed] = useState(true);
  return (
    <View style={{ alignSelf: 'stretch', gap: 8 }}>
      <ScalePressable
        accessibilityRole="button"
        onPress={() => setCollapsed((v) => !v)}
        style={{ alignSelf: 'center', padding: 8 }}>
        <Text>{collapsed ? '펼치기' : '접기'}</Text>
      </ScalePressable>
      <Calendar
        value={date}
        onSelect={setDate}
        today="2026-09-16"
        weekOf={collapsed ? date : null}
      />
    </View>
  );
}

/** 진행 바 데모 (#696) — 버튼으로 진행률을 올려 스프링·플래시를 확인한다. */
function SpringProgressDemo() {
  const [progress, setProgress] = useState(0.4);
  return (
    <View style={{ alignSelf: 'stretch', gap: 12 }}>
      <SpringProgressBar progress={progress} color="#7FA87F" trackColor="#8888883A" />
      <SpringProgressBar progress={progress} color="#7FA87F" trackColor="#8888883A" height={6} />
      <ScalePressable
        accessibilityRole="button"
        onPress={() => setProgress((p) => (p >= 1 ? 0 : Math.min(1, p + 0.3)))}
        style={{ alignSelf: 'center', padding: 8 }}>
        <Text>진행 +30% (100%에서 플래시 · 다시 누르면 0%)</Text>
      </ScalePressable>
    </View>
  );
}

/** 휠 데모 (#390) — 시 휠 하나로 스와이프/탭 선택을 확인한다. */
function WheelPickerDemo() {
  const [hour, setHour] = useState(7);
  return (
    <View style={{ width: 120, alignSelf: 'center' }}>
      <WheelPicker
        items={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}시` }))}
        value={hour}
        onChange={setHour}
        accessibilityLabel="시 선택"
      />
    </View>
  );
}

function ReportSheetDemo() {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <Button label="신고 시트 열기" variant="danger" onPress={() => setVisible(true)} />
      <ReportSheet
        visible={visible}
        targetLabel="게시물"
        onSubmit={() => setVisible(false)}
        onClose={() => setVisible(false)}
      />
    </View>
  );
}

/** Opens the shared confirm dialog in its destructive form. */
function ConfirmDialogDemo() {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <Button label="삭제 확인 열기" variant="danger" onPress={() => setVisible(true)} />
      <ConfirmDialog
        visible={visible}
        title="루틴 삭제"
        body={'이 루틴을 삭제할까요?\n삭제하면 지난 수행 기록도 함께 사라져요.'}
        confirmLabel="삭제"
        destructive
        onConfirm={() => setVisible(false)}
        onCancel={() => setVisible(false)}
      />
    </View>
  );
}

/** Opens the form-holding modal card over a fixed-height area (장부 7번). */
function ModalCardDemo() {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ alignSelf: 'stretch', height: 260 }}>
      <Button label="모달 카드 열기" onPress={() => setOpen(true)} />
      {open ? (
        <ModalCard
          title="미션 만들기"
          cancel={{ label: '취소', onPress: () => setOpen(false) }}
          confirm={{ label: '만들기', onPress: () => setOpen(false) }}>
          <Text style={{ marginTop: 12 }}>폼 본문이 여기에 들어가요.</Text>
        </ModalCard>
      ) : null}
    </View>
  );
}

/** Buttons that fire each toast variant (needs its own provider in the gallery). */
function ToastDemo() {
  const { show } = useToast();
  return (
    <View style={{ alignSelf: 'stretch', gap: 8, minHeight: 200 }}>
      <Button label="정보 토스트" onPress={() => show('저장했어요')} />
      <Button
        label="성공 토스트"
        variant="secondary"
        onPress={() => show('구매 완료!', 'success')}
      />
      <Button
        label="에러 토스트"
        variant="danger"
        onPress={() => show('저장에 실패했어요', 'error')}
      />
    </View>
  );
}

export const designEntries: GalleryEntry[] = [
  {
    name: 'Design tokens · active theme',
    description: 'Brand semantic colors, Astryx-aligned naming (default: cozy).',
    render: () => <TokenSwatches />,
  },
  {
    name: 'Type scale',
    description: 'Named typography roles (Astryx standard: base ≈ 16, ratio ≈ 1.2).',
    render: () => <TypeScalePreview />,
  },
  {
    name: 'ScalePressable · 프레스 스케일',
    description: '누르는 동안 0.96으로 눌리는 공용 Pressable (#442) — 버튼 기본 손맛.',
    render: () => (
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel="눌러보기"
        style={{
          alignSelf: 'center',
          backgroundColor: '#7FA87F',
          borderRadius: 999,
          paddingHorizontal: 24,
          paddingVertical: 12,
        }}>
        <Text style={{ color: '#FFFFFF' }}>눌러보기</Text>
      </ScalePressable>
    ),
  },
  {
    name: 'BottomNav · PagerScrollView · 리퀴드 바 드래그와 본문 스와이프',
    description:
      'iOS 본문 가로·대각선 스와이프와 세로 스크롤·당겨서 새로고침 경쟁 확인. 내 정보는 일반 스크롤. 집 확대 잠금 중에도 하단바는 동작.',
    render: () => <NavigationPreview />,
  },
  {
    name: 'GlassSurface · 떠 있는 버튼의 글래스 면',
    description:
      'iOS 26 리퀴드 글래스 원/알약 (#1050) — 글래스 불가 환경(웹·Android·iOS 25)에서는 fallbackColor 면. 방·집 화면의 떠 있는 버튼이 쓴다.',
    render: () => (
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', alignSelf: 'center' }}>
        <GlassSurface
          fallbackColor="#FFFFFF"
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text>🎁</Text>
        </GlassSurface>
        <GlassSurface
          fallbackColor="#FFFFFF"
          interactive={false}
          style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
          <Text>라벨</Text>
        </GlassSurface>
      </View>
    ),
  },
  {
    name: 'BearCheck · 곰 헤드 체크 토글',
    description:
      '루틴 완료 토글 (#344, design-sync 시안 A) — 미완료 윤곽 / 완료 = 카테고리 색 + 흰 체크.',
    render: () => (
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', alignSelf: 'center' }}>
        <BearCheck checked={false} />
        <BearCheck checked color="#E8A87C" />
        <BearCheck checked color="#7FA8D4" />
        <BearCheck checked color="#C8869C" />
        <BearCheck checked color="#7FA87F" />
      </View>
    ),
  },
  {
    name: 'PawRefreshScroll · 곰 발바닥 당겨서 새로고침',
    description:
      '나의 방·집 스크롤의 커스텀 pull-to-refresh (#454) — 맨 위에서 당기면 발바닥이 자라나고, 놓으면 새로고침 동안 두근거린다. (네이티브 전용 — 웹은 일반 스크롤)',
    render: () => (
      <View style={{ height: 360, alignSelf: 'stretch' }}>
        <PawRefreshScroll
          onRefresh={() => new Promise((resolve) => setTimeout(resolve, 1600))}
          contentContainerStyle={{ padding: 16, gap: 12 }}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} style={{ height: 48, borderRadius: 12, backgroundColor: '#8888883A' }} />
          ))}
        </PawRefreshScroll>
      </View>
    ),
  },
  {
    name: 'WheelPicker · 스와이프 휠',
    description:
      '알림 시간 시트의 시간 선택 휠 (#390, design-sync Time wheel picker 채택) — 스냅 스와이프 + 행 탭 선택.',
    render: () => <WheelPickerDemo />,
  },
  {
    name: 'CategoryIcon · 스티커 팝',
    description:
      '카테고리 아이콘 16종 (#398, design-sync A안) — 카테고리 색 하나에서 파스텔·액센트·포인트 톤 파생.',
    render: () => (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {(Object.keys(CATEGORY_ICON_GEOMETRY) as (keyof typeof CATEGORY_ICON_GEOMETRY)[]).map(
          (n, i) => (
            <CategoryIcon
              key={n}
              name={n}
              color={['#E8A87C', '#7FA8D4', '#C8869C', '#96B39A'][i % 4]}
              size={32}
            />
          ),
        )}
      </View>
    ),
  },
  {
    name: 'CoinIcon · 발바닥 각인 동전',
    description:
      '코인 글리프 (#512, 시안 B) — 골드 동전 + 곰 발바닥 각인, 14px 미만은 발가락 단순화.',
    render: () => (
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', alignSelf: 'center' }}>
        <CoinIcon size={48} />
        <CoinIcon size={22} />
        <CoinIcon size={18} />
        <CoinIcon size={14} />
        <CoinIcon size={12} />
      </View>
    ),
  },
  {
    name: 'SpringProgressBar · 스프링 진행 바',
    description:
      '공용 진행 바 (#440·#503, #696 승격) — 차오를 때 바운스, 줄어들 때 클램프, 100% 흰 플래시.',
    render: () => <SpringProgressDemo />,
  },
  {
    name: 'CoachMarkOverlay · 스포트라이트',
    description: '코치마크 튜토리얼 오버레이 (#351) — 구멍 뚫린 딤 + 말풍선.',
    render: () => (
      <View style={{ height: 420, alignSelf: 'stretch' }}>
        <CoachMarkOverlay
          steps={[{ target: 'demo', title: '오늘의 루틴', body: '곰 발바닥을 누르면 루틴 완료!' }]}
          index={0}
          targets={{ demo: { x: 40, y: 60, w: 220, h: 48 } }}
          frame={{ w: 340, h: 420 }}
          onNext={() => {}}
          onSkip={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'ListRow',
    description: '설정·내 정보 공용 목록 행 — 아이콘 원 + 라벨 + 화살표, 마지막 행은 구분선 없음.',
    render: () => (
      <View style={{ alignSelf: 'stretch' }}>
        <ListRow icon="help" label="도움말" />
        <ListRow icon="bug" label="버그 제보" last />
      </View>
    ),
  },
  {
    name: 'LinkifiedText',
    description:
      '링크 인식 글 (#1507) — 채팅·피드 글·댓글. http(s)://·www. 주소를 밑줄 링크로, 누르면 도메인 확인 후 앱 안 브라우저.',
    render: () => (
      <LinkifiedText>
        {'이 영상 봐요 https://www.youtube.com/watch?v=abc. 그리고 www.rougether.com 도!'}
      </LinkifiedText>
    ),
  },
  {
    name: 'Loading · 공용 로딩 표시',
    description:
      '지연 표시(기본 250ms) — 빨리 끝나는 로딩은 아무것도 안 보인다 (#849). 아래는 지연을 꺼서 바로 보이게 한 것.',
    render: () => (
      <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 16 }}>
        <Loading delayMs={0} />
        <Loading delayMs={0} size="large" />
        <Text>↑ 기본(small) · large. 실제 화면에서는 250ms 안에 끝나면 안 보인다.</Text>
      </View>
    ),
  },
  {
    name: 'Calendar',
    description: 'Pure-JS month-grid date picker used by the duration sheet (#5).',
    render: () => (
      <View style={{ alignSelf: 'stretch' }}>
        <Calendar value="2026-06-15" onSelect={() => {}} />
      </View>
    ),
  },
  {
    name: 'Calendar · 주 접힘',
    description:
      '주간 보기 모드 (#1327): 선택 주만 남기고 접힘, ‹ ›·가로 플링이 주 이동. 버튼으로 접기/펼치기.',
    render: () => <CalendarWeekDemo />,
  },
  {
    name: 'UI · Button',
    description: 'Shared button (primary / secondary / danger), token-styled, vector left icon.',
    render: () => (
      <View style={{ alignSelf: 'stretch', gap: 8 }}>
        <Button label="저장" onPress={() => {}} />
        <Button glass label="게임 시작" onPress={() => {}} />
        <Button glass label="랭킹" variant="secondary" onPress={() => {}} />
        <Button label="집 만들기" variant="secondary" leftIcon="add" onPress={() => {}} />
        <Button label="삭제하기" variant="danger" leftIcon="trash" onPress={() => {}} />
        <Button label="비활성" disabled onPress={() => {}} />
      </View>
    ),
  },
  {
    name: 'UI · IconButton',
    description: 'Circular icon button (Ionicons, no emoji) — header/action chrome.',
    render: () => (
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <IconButton name="back" accessibilityLabel="뒤로" onPress={() => {}} />
        <IconButton name="edit" accessibilityLabel="편집" onPress={() => {}} />
        <IconButton name="gift" accessibilityLabel="가챠" variant="primary" onPress={() => {}} />
        <IconButton name="close" accessibilityLabel="닫기" onPress={() => {}} />
      </View>
    ),
  },
  {
    name: 'UI · ScreenHeader',
    description: 'Standard header: back + title + right slot.',
    render: () => (
      <View style={{ alignSelf: 'stretch' }}>
        <ScreenHeader title="가챠" onBack={() => {}} right={<Pill label="5,600" icon="coin" />} />
      </View>
    ),
  },
  {
    name: 'UI · Pill / Badge / Card',
    description: 'Small chips and a surface card.',
    render: () => (
      <View style={{ alignSelf: 'stretch', gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pill label="Lv.20" icon="star" />
          <Pill label="5,600" icon="coin" />
          <Badge label="전설" />
        </View>
        <Card>
          <Badge label="MY" />
        </Card>
      </View>
    ),
  },
  {
    name: 'UI · PendingNotice',
    description: '서버 준비 중(엔드포인트 미구현) 정직화 배너.',
    render: () => <PendingNotice text="이 기능은 서버 준비 중이에요." />,
  },
  {
    name: 'App · 오류 복구 화면',
    description:
      '화면 렌더 중 예외가 나면 흰 화면 대신 뜨는 복구 화면 (#1376). 에러는 Sentry ErrorBoundary가 보내고, 다시 시도는 트리를 새로 그린다.',
    render: () => (
      <View style={{ height: 420, alignSelf: 'stretch' }}>
        <AppErrorFallback onRetry={() => console.log('[dev] 다시 시도 — 경계 초기화')} />
      </View>
    ),
  },
  {
    name: 'UI · RetryState',
    description: '로드 실패 공용 블록 (#557) — 메시지(+보조 문구)와 다시 시도 필.',
    render: () => (
      <View style={{ alignSelf: 'stretch', gap: 24 }}>
        <RetryState message="데이터를 불러오지 못했어요." onRetry={() => {}} />
        <RetryState
          message="친구 방을 불러오지 못했어요"
          detail="네트워크 상태를 확인하고 다시 시도해 주세요."
          onRetry={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'UI · ReportSheet',
    description:
      '콘텐츠 신고 시트 (#1428) — 사유 7종 라디오, 선택 설명 500자, 사유를 골라야 신고하기가 켜진다. 버튼으로 열어보기.',
    render: () => <ReportSheetDemo />,
  },
  {
    name: 'UI · ConfirmDialog',
    description: '백드롭+카드 확인 다이얼로그 (#557) — 버튼으로 열어보기.',
    render: () => <ConfirmDialogDemo />,
  },
  {
    name: 'UI · ModalCard',
    description: '폼을 담는 화면 위 모달 카드 (장부 7번) — 집 정보 수정·미션 만들기가 쓴다.',
    render: () => <ModalCardDemo />,
  },
  {
    name: 'UI · NotificationBanner',
    description:
      '앱이 켜져 있을 때 뜨는 인앱 푸시 배너 (#902) — 종류별 아이콘 + 제목/본문, 탭하면 알림함. 갤러리에서는 자동으로 안 닫힌다.',
    render: () => (
      <View style={{ alignSelf: 'stretch', minHeight: 96 }}>
        <NotificationBanner
          type="FRIEND_CHEER"
          title="루티니1님이 응원을 보냈어요"
          body="오늘도 루틴 지키는 중! 화이팅 🐾"
          visibleMs={0}
          onPress={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'UI · SheetHandle',
    description: '바텀시트 드래그 그래버 (#1015) — 세 시트에 복제돼 있던 40×4 pill의 공용화.',
    render: () => <SheetHandle />,
  },
  {
    name: 'UI · MissionBanner · 첫 실행',
    description:
      '온보딩 미션 진행 배너 (#571) — 깃발 표식 + 미션 N/4. 첫 실행에는 건너뛰기가 없다 (#1023).',
    render: () => (
      <View style={{ alignSelf: 'stretch', minHeight: 80 }}>
        <MissionBanner stepIndex={1} totalSteps={3} label="뽑기 1회 해보기" onPress={() => {}} />
      </View>
    ),
  },
  {
    name: 'UI · MissionBanner · 다시 보기',
    description:
      '설정 → 튜토리얼 다시 보기로 시작된 체인 (#1023) — 건너뛰기(확인 다이얼로그)가 붙는다.',
    render: () => (
      <View style={{ alignSelf: 'stretch', minHeight: 80 }}>
        <MissionBanner
          stepIndex={1}
          totalSteps={3}
          label="뽑기 1회 해보기"
          onPress={() => {}}
          onSkip={() => {}}
          canSkip
        />
      </View>
    ),
  },
  {
    name: 'UI · Toast',
    description: '하단 토스트 (info / success / error) — useToast().show(...)로 발사.',
    render: () => (
      <ToastProvider>
        <ToastDemo />
      </ToastProvider>
    ),
  },
];
