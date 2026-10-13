import type { AppLanguage } from '@/i18n';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { HelpScreen } from '@/components/screens/help-screen';
import { IntroScreen } from '@/components/screens/intro-screen';
import { LoginScreen } from '@/components/screens/login-screen';
import { LoginConflictDialog } from '@/components/screens/login/login-conflict-dialog';
import { CharacterPickerSheet } from '@/components/screens/sheets/character-picker-sheet';
import { BugReportScreen } from '@/components/screens/bug-report-screen';
import { FeedScreen } from '@/components/screens/feed-screen';
import { FeedPostScreen } from '@/components/screens/feed-post-screen';
import { BlockedUsersScreen } from '@/components/screens/blocked-users-screen';
import { FeedComposeScreen } from '@/components/screens/feed-compose-screen';
import type {
  FeedBoardFilter,
  FeedBoardType,
  FeedRoutineCompletion,
} from '@/components/screens/feed/types';
import { FeedRoutinePicker } from '@/components/feed/feed-routine';
import { MyPageScreen } from '@/components/screens/my-page-screen';
import { OnboardingScreen } from '@/components/screens/onboarding-screen';
import { OnboardingHouseScreen } from '@/components/screens/onboarding-house-screen';
import { StarterRoutineScreen } from '@/components/screens/starter-routine-screen';
import { recommendStarterRoutines } from '@/constants/starter-routines';
import { PasswordChangeScreen } from '@/components/screens/password-change-screen';
import { PolicyViewerScreen } from '@/components/screens/policy-viewer-screen';
import { ProfileEditScreen } from '@/components/screens/profile-edit-screen';
import { LanguageScreen } from '@/components/screens/language-screen';
import { FontScreen } from '@/components/screens/font-screen';
import { AppearancePreview } from '@/components/screens/settings/appearance-preview';
import { ThemeScreen } from '@/components/screens/theme-screen';
import { SettingsScreen } from '@/components/screens/settings-screen';
import { SoundSettingsScreen } from '@/components/screens/sound-settings-screen';
import { SignupScreen } from '@/components/screens/signup-screen';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Button } from '@/components/ui/button';
import { AttendanceSheet } from '@/components/screens/sheets/attendance-sheet';
import { MissionSheet } from '@/components/screens/sheets/mission-sheet';
import { policyUrl } from '@/constants/policy';
import {
  DEMO_FEED_COMMENTS,
  DEMO_FEED_COMPLETIONS,
  DEMO_FEED_DRAFT,
  DEMO_FEED_POSTS,
  DEMO_FEED_TEXT_POST,
  DEMO_FEED_TODAY,
} from '@/mocks/fixtures';
import type { GalleryEntry } from '@/dev/registry/types';

/** 피드 게시판 필터 데모 (서버 #428) — 전체/자유/인증을 눌러 로컬 픽스처를 거른다. */
function FeedScreenDemo() {
  const [board, setBoard] = useState<FeedBoardFilter>('ALL');
  const all = [DEMO_FEED_TEXT_POST, ...DEMO_FEED_POSTS];
  const posts = board === 'ALL' ? all : all.filter((p) => p.boardType === board);
  return (
    <FeedScreen
      posts={posts}
      board={board}
      onChangeBoard={setBoard}
      onCompose={() => {}}
      onToggleLike={() => {}}
    />
  );
}

/**
 * 피드 작성 게시판 선택 데모 (서버 #428·#430) — 자유는 글만으로도, 인증은 사진과 최근 7일
 * 완료 루틴이 있어야 켜진다.
 */
function FeedComposeDemo() {
  const [board, setBoard] = useState<FeedBoardType>('FREE');
  const [content, setContent] = useState('');
  const [routine, setRoutine] = useState<FeedRoutineCompletion | null>(null);
  return (
    <FeedComposeScreen
      board={board}
      onChangeBoard={setBoard}
      routine={routine}
      onChangeRoutine={setRoutine}
      routinePicker={FEED_DEMO_PICKER}
      today={DEMO_FEED_TODAY}
      content={content}
      onChangeContent={setContent}
      onSubmit={() => {}}
    />
  );
}

const FEED_DEMO_PICKER = { groups: DEMO_FEED_COMPLETIONS, loading: false, error: false };

/** 인증할 루틴 고르기 데모 (#1456) — 오늘·어제·M/D 묶음, 하나만 고른다. */
function FeedRoutinePickerDemo() {
  const [routine, setRoutine] = useState<FeedRoutineCompletion | null>(null);
  return (
    <View style={{ alignSelf: 'stretch', gap: 24 }}>
      <FeedRoutinePicker
        picker={FEED_DEMO_PICKER}
        value={routine}
        onChange={setRoutine}
        today={DEMO_FEED_TODAY}
      />
      <FeedRoutinePicker picker={{ groups: [], loading: false, error: false }} value={null} />
    </View>
  );
}

/** 타 provider 가입 안내 데모 (#1128) — 버튼으로 열고, 어느 선택이든 닫힌다. */
function LoginConflictDialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <ScalePressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{ alignSelf: 'center', padding: 8 }}>
        <Text>가입 충돌 안내 열기</Text>
      </ScalePressable>
      <LoginConflictDialog
        visible={open}
        message="이 이메일은 애플 로그인으로 가입되어 있어요."
        providers={['apple']}
        onLoginWith={() => setOpen(false)}
        onContinueAsNew={() => setOpen(false)}
        onDismiss={() => setOpen(false)}
      />
    </View>
  );
}

/** 언어 화면 데모 (#893) — 프로바이더 없이 선택 상태만 바뀐다. */
function LanguageScreenDemo() {
  const [language, setLanguage] = useState<AppLanguage>('ko');
  return (
    <View style={{ alignSelf: 'stretch', height: 360 }}>
      <LanguageScreen language={language} onSelectLanguage={setLanguage} />
    </View>
  );
}

/**
 * 출석 시트 데모 (#851) — 실제로 출석이 되게 해서 도장·코인·카운트업 연출을
 * 갤러리에서 확인할 수 있다. 10일차를 채우면 트로피 리빌까지 이어진다.
 */
function AttendanceSheetDemo() {
  const [open, setOpen] = useState(false);
  const [streak, setStreak] = useState(3);
  // 갤러리에서는 오늘 출석 잠금을 걸지 않는다 — 연속으로 눌러 7일차까지
  // 걸어가며 보너스 링·생성권 완료 안내까지 확인하기 위해서다. 실제 시트는
  // checkedInToday가 true가 되면 버튼이 잠긴다.
  const today = false;
  const status = {
    eventId: 7,
    code: 'ATTENDANCE_7D_2026',
    title: '7일 연속 출석',
    startsOn: '2026-08-16',
    endsOn: '2026-09-14',
    targetDays: 7,
    currentStreak: streak,
    checkedInToday: today,
    completed: streak >= 7,
    checkInDates: [],
    dailyRewards: Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      coinAmount: i + 1 === 5 ? 50 : 30,
      furnitureReward: false,
      generationCreditAmount: i + 1 === 7 ? 1 : 0,
      claimed: i + 1 <= streak,
    })),
    reward: {
      itemId: null,
      type: 'GENERATION_CREDIT' as const,
      generationCreditAmount: 1,
      name: 'AI 가구 생성권',
      assetKey: null,
      userItemId: null,
      received: false,
    },
  };
  return (
    <View style={{ alignSelf: 'stretch', gap: 8 }}>
      <ScalePressable
        accessibilityRole="button"
        onPress={() => {
          setStreak(3);
          setOpen(true);
        }}
        style={{ alignSelf: 'center', padding: 8 }}>
        <Text>출석 시트 열기 (3일차부터)</Text>
      </ScalePressable>
      <AttendanceSheet
        visible={open}
        onClose={() => setOpen(false)}
        status={status}
        onCheckIn={async () => {
          const next = Math.min(streak + 1, 7);
          setStreak(next);
          return {
            newCheckIn: true,
            coinRewardAmount: next === 5 ? 50 : 30,
            coinBalance: 190,
            rewardGrantedNow: next >= 7,
            status: { ...status, currentStreak: next, checkedInToday: true },
          };
        }}
      />
    </View>
  );
}

/** 캐릭터 교체 시트 데모 (#854) — 열기 버튼 뒤에 둔다. 아래 참고. */
function CharacterPickerSheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <ScalePressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{ alignSelf: 'center', padding: 8 }}>
        <Text>캐릭터 교체 열기</Text>
      </ScalePressable>
      <CharacterPickerSheet
        visible={open}
        characters={[
          { serverId: 1, id: 'cat', name: '고양이', selected: true },
          { serverId: 4, id: 'panda', name: '판다', selected: false },
          { serverId: 8, id: 'otter', name: '수달', selected: false },
        ]}
        onSelect={() => {}}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

function MissionSheetDemo() {
  const [visible, setVisible] = useState(false);
  const [last, setLast] = useState(false);
  return (
    <View style={{ alignSelf: 'stretch', gap: 8 }}>
      <Button
        label="미션 1 완료 시트 열기"
        onPress={() => {
          setLast(false);
          setVisible(true);
        }}
      />
      <Button
        label="마지막 미션(축하) 시트 열기"
        variant="secondary"
        onPress={() => {
          setLast(true);
          setVisible(true);
        }}
      />
      <MissionSheet
        visible={visible}
        completedStep={last ? 4 : 1}
        totalSteps={3}
        nextLabel={last ? null : '뽑기 1회 해보기'}
        onGo={() => setVisible(false)}
        onClose={() => setVisible(false)}
      />
    </View>
  );
}

export const memberEntries: GalleryEntry[] = [
  {
    name: 'LoginScreen',
    description:
      'Ported from the prototype AuthScreen (#2). Preview at fixed height, 최근 로그인 배지는 카카오에.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <LoginScreen lastLoginProvider="kakao" />
      </View>
    ),
  },
  {
    name: 'LoginConflictDialog',
    description:
      '같은 이메일 타 provider 계정 안내(서버 409, #1128): 기존 provider로 로그인 또는 새 계정으로 계속.',
    render: () => <LoginConflictDialogDemo />,
  },
  {
    name: 'SignupScreen',
    description: 'Ported from the prototype SignupScreen (#3). Preview at fixed height.',
    render: () => (
      <View style={{ height: 900, alignSelf: 'stretch' }}>
        <SignupScreen onViewPolicy={(doc) => openBrowserAsync(policyUrl(doc))} />
      </View>
    ),
  },
  {
    name: 'IntroScreen · 로그인 전 소개',
    description:
      "설치 후 첫 진입에 로그인보다 먼저 뜨는 소개 5장 (#1282). 첫 장에만 '이미 계정이 있어요', 마지막 장 '시작하기'는 로그인 화면으로(여기서는 콘솔 로그).",
    render: () => (
      <View style={{ height: 720, alignSelf: 'stretch' }}>
        <IntroScreen
          onHaveAccount={() => console.log('[dev] 이미 계정이 있어요 — 로그인으로')}
          onDone={() => console.log('[dev] 소개 완료 — 로그인으로')}
        />
      </View>
    ),
  },
  {
    name: 'OnboardingScreen · 첫 실행',
    description:
      'Ported from the prototype OnboardingScreen (#4): goals → (캐러셀은 MVP 오프 #637 — 갤러리는 열어 보존 UI 확인) → nickname. 소개는 로그인 전으로 옮겼다 (#1282).',
    render: () => (
      <View style={{ height: 720, alignSelf: 'stretch' }}>
        <OnboardingScreen characterSelectEnabled />
      </View>
    ),
  },
  {
    name: 'StarterRoutineScreen · 관심사로 첫 루틴',
    description:
      '운동·독서·정리에서 하나씩 추천. 선택 후 바로 시작하며 서버 쓰기 없이 화면만 확인한다 (#1148).',
    render: () => (
      <View style={{ height: 780, alignSelf: 'stretch' }}>
        <StarterRoutineScreen
          recommendations={recommendStarterRoutines([
            { id: 'exercise', label: '운동' },
            { id: 'reading', label: '독서' },
            { id: 'organizing', label: '정리' },
          ])}
        />
      </View>
    ),
  },
  {
    name: 'OnboardingHouseScreen · 집 선택',
    description:
      '첫 루틴 뒤, 앱 진입 직전의 집 선택 (#1407). 좋아요는 자동 입주 허용 공개 집에 합류, 괜찮아요는 내 집. 서버 쓰기 없이 화면만.',
    render: () => (
      <View style={{ height: 720, alignSelf: 'stretch' }}>
        <OnboardingHouseScreen onChoose={(choice) => console.log('choose', choice)} />
      </View>
    ),
  },
  {
    name: 'OnboardingHouseScreen · 합류 결과',
    description: "좋아요를 골라 '아침형 인간들'에 합류한 결과 카드 (#1407).",
    render: () => (
      <View style={{ height: 720, alignSelf: 'stretch' }}>
        <OnboardingHouseScreen
          outcome={{ result: 'JOINED', houseName: '아침형 인간들', memberCount: 3 }}
        />
      </View>
    ),
  },
  {
    name: 'OnboardingScreen · 다시 보기',
    description:
      '설정 → 튜토리얼 다시 보기 진입 (#1023) — 소개부터 다시 보고(#1282) 목표 수정으로 이어진다. 우상단 건너뛰기를 누르면 목표 설문이 아니라 온보딩을 끝낸다(여기서는 콘솔 로그).',
    render: () => (
      <View style={{ height: 720, alignSelf: 'stretch' }}>
        <OnboardingScreen
          characterSelectEnabled
          replay
          initialGoals={['exercise']}
          onSkip={() => console.log('[dev] 온보딩 건너뛰기 — 앱으로 복귀')}
        />
      </View>
    ),
  },
  {
    name: 'MyPageScreen',
    description:
      '내 정보 탭 (#1088): 프로필 카드·지표 한 줄·계정/콘텐츠 행. 설정은 헤더 우측 톱니 뒤 서브화면.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <MyPageScreen
          nickname="준서"
          bio="매일 조금씩"
          streakDays={12}
          coinBalance={1240}
          diamondBalance={3}
        />
      </View>
    ),
  },
  {
    name: 'SettingsScreen',
    description:
      '내 정보의 서브화면 (#1088): 디자인(다크모드·테마·폰트)·알림·기타·로그아웃·회원탈퇴. 업데이트 카드는 #1095에서 뺐다.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <SettingsScreen onBack={() => {}} />
      </View>
    ),
  },
  {
    name: 'ThemeScreen',
    description: '설정 → 테마 색상 (#459): 라이브 미리보기 + 테마 5종 선택.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <ThemeScreen />
      </View>
    ),
  },
  {
    name: 'AppearancePreview',
    description:
      '테마 색상·폰트 피커 공용 미리보기 카드 (#750): 활성 토큰·타입 스케일 그대로. 닉네임·캐릭터는 내 것 (#899).',
    render: () => <AppearancePreview userName="루티" characterId="otter" />,
  },
  {
    name: 'FontScreen',
    description: '설정 → 폰트 (#750): 라이브 미리보기 + 글자 스와치로 폰트 5종 선택.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <FontScreen />
      </View>
    ),
  },
  {
    name: 'ProfileEditScreen',
    description: '설정 → 프로필 편집: 닉네임 + 한 줄 소개 편집.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <ProfileEditScreen />
      </View>
    ),
  },
  {
    name: 'PasswordChangeScreen',
    description: '설정 → 비밀번호 변경: 현재/새 비밀번호 검증.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <PasswordChangeScreen />
      </View>
    ),
  },
  {
    name: 'CharacterPickerSheet',
    description: '나의 방 햄버거 → 캐릭터 교체: 보유 캐릭터 그리드 + 착용 중 배지.',
    render: () => <CharacterPickerSheetDemo />,
  },
  {
    name: 'FeedScreen',
    description:
      '공개 피드 탭 (#1409, FEED_ENABLED로 숨김): 위에 [전체 | 자유 | 인증] 게시판 필터(서버 #428), 카드(작성자·게시판 배지·첫 사진+장수·본문 3줄, 사진 없는 자유글은 8줄·좋아요/댓글), 떠 있는 + 작성 버튼. 로컬 픽스처 — 서버 요청·쓰기 없음, 사진은 자리표시.',
    render: () => (
      <View style={{ height: 720, alignSelf: 'stretch' }}>
        <FeedScreenDemo />
      </View>
    ),
  },
  {
    name: 'FeedPostScreen',
    description:
      '피드 게시물 상세 (#1409): 사진 가로 넘김, "✓ 루틴 · M/D 완료" 배지(서버 #430), 본문, 좋아요, 오래된 순 댓글 + 입력칸. 내 댓글에만 삭제. 로컬 픽스처.',
    render: () => (
      <View style={{ height: 720, alignSelf: 'stretch' }}>
        <FeedPostScreen
          post={DEMO_FEED_POSTS[0]}
          comments={DEMO_FEED_COMMENTS}
          onAddComment={() => true}
          onDeleteComment={() => {}}
          onToggleLike={() => {}}
          onReportPost={() => true}
          onReportComment={() => true}
          onBlockUser={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'FeedPostScreen · 자유게시판 글',
    description:
      '사진 없는 자유게시판 글 상세 (서버 #428): 사진 자리 없이 작성자·자유 배지·본문. 내 글이면 수정 창에서 인증게시판은 잠겨 있고(사진 없음, 서버 #430) 본문은 비울 수 없다. 로컬 픽스처.',
    render: () => (
      <View style={{ height: 560, alignSelf: 'stretch' }}>
        <FeedPostScreen
          post={{ ...DEMO_FEED_TEXT_POST, mine: true }}
          comments={[]}
          onAddComment={() => true}
          onToggleLike={() => {}}
          onEditPost={() => true}
          onDeletePost={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'BlockedUsersScreen',
    description:
      '설정 > 차단한 사용자 (#1428, MODERATION_ENABLED로 숨김): 최근 차단순 목록, 차단 해제는 확인 다이얼로그 뒤. 로컬 픽스처 — 서버 요청 없음.',
    render: () => (
      <View style={{ height: 560, alignSelf: 'stretch' }}>
        <BlockedUsersScreen
          users={[
            {
              userId: 8,
              nickname: '이웃',
              profileImageKey: null,
              blockedAt: '2026-09-29T03:00:00Z',
            },
            { userId: 9, nickname: null, profileImageKey: null, blockedAt: '2026-09-28T03:00:00Z' },
          ]}
          onUnblock={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'FeedComposeScreen',
    description:
      '피드 작성 (#1409): 사진 타일(올리는 중·완료·실패 다시), 본문 2,000자 카운터. 전부 올라가야 올리기가 켜진다. 로컬 픽스처.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <FeedComposeScreen
          board="VERIFICATION"
          images={DEMO_FEED_DRAFT}
          content="오늘의 루틴 인증"
        />
      </View>
    ),
  },
  {
    name: 'FeedPostScreen · 내 사진 글 수정(게시판 전환)',
    description:
      '내 사진 있는 자유글 (서버 #430): 수정 창에서 인증으로 옮기면 최근 7일 완료 루틴을 골라야 저장된다. 로컬 픽스처.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <FeedPostScreen
          post={DEMO_FEED_POSTS[1]}
          comments={[]}
          onEditPost={() => true}
          onDeletePost={() => {}}
          routinePicker={FEED_DEMO_PICKER}
          today={DEMO_FEED_TODAY}
        />
      </View>
    ),
  },
  {
    name: 'FeedRoutinePicker',
    description:
      '인증할 루틴 고르기 (#1456, 서버 #430): 최근 7일 완료 루틴을 오늘·어제·M/D로 묶어 하나만 고른다. 아래는 빈 상태.',
    render: () => <FeedRoutinePickerDemo />,
  },
  {
    name: 'FeedComposeScreen · 자유게시판',
    description:
      '피드 작성의 게시판 선택 (서버 #428·#430): 자유는 사진 없이 본문만으로 올리기가 켜지고, 인증으로 바꾸면 최근 7일 완료 루틴 고르기와 사진 1장 이상이 필요하다는 안내. 로컬 상태만.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <FeedComposeDemo />
      </View>
    ),
  },
  {
    name: 'BugReportScreen',
    description: '설정 → 버그 제보: 제보 폼(제목·내용·스크린샷) + 내 제보 내역.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <BugReportScreen
          entries={[
            { id: 2, title: '달력 원 정렬이 어긋나요', status: 'IN_PROGRESS', date: '7월 20일' },
            { id: 1, title: '로그인이 안 돼요', status: 'RESOLVED', date: '7월 12일' },
          ]}
        />
      </View>
    ),
  },
  {
    name: 'SoundSettingsScreen',
    description: '설정 → 효과음: 효과음 / 배경 음악 / 햅틱 토글.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <SoundSettingsScreen />
      </View>
    ),
  },
  {
    name: 'HelpScreen',
    description: '설정 → 도움말: FAQ 아코디언 + 문의 + 버전.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <HelpScreen />
      </View>
    ),
  },
  {
    name: 'PolicyViewerScreen',
    description: '설정/가입 → 약관·처리방침 인앱 웹뷰 (#652). 웹은 iframe 변형.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <PolicyViewerScreen title="이용약관" url="https://rougether.com/terms.html" />
      </View>
    ),
  },
  {
    name: 'AttendanceSheet',
    description:
      '연속 출석 시트 (#851) — 눌러서 도장·코인·카운트업 연출 확인. 7일차엔 AI 가구 생성권.',
    render: () => <AttendanceSheetDemo />,
  },
  {
    name: 'LanguageScreen',
    description: '설정 → 언어 (#893): 한국어/English 즉시 적용. 갤러리에선 선택만 바뀐다.',
    render: () => <LanguageScreenDemo />,
  },
  {
    name: 'MissionSheet · 완료 전환',
    description: '미션 완료 전환 시트 (#571) — 다음 미션 안내와 하러 가기.',
    render: () => <MissionSheetDemo />,
  },
];
