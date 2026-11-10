import { useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import type { AttendanceCheckInResult, AttendanceStatus } from '@/api/events';
import { ChristmasAttendanceModal } from '@/components/screens/christmas/christmas-attendance-modal';
import { ChristmasEventPopup } from '@/components/screens/christmas/christmas-event-popup';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { RoomQuickTodoPreview } from '@/dev/todo-compose-preview';
import { CHRISTMAS_PREVIEW } from '@/dev/christmas-gacha-preview';
import { GachaPhonePreview } from '@/dev/gacha-phone-preview';

const FIXTURE_STATUS: AttendanceStatus = {
  eventId: 2026,
  code: 'christmas_2026',
  title: '크리스마스',
  startsOn: '2026-11-09',
  endsOn: '2026-12-25',
  targetDays: 30,
  mode: 'CUMULATIVE',
  progressDays: 0,
  currentStreak: 0,
  active: true,
  availableToday: true,
  checkedInToday: false,
  completed: false,
  checkInDates: [],
  reward: null,
  dailyRewards: Array.from({ length: 30 }, (_, index) => ({
    day: index + 1,
    coinAmount: (index + 1) % 5 === 0 ? 60 : 30,
    claimed: false,
    furnitureReward: false,
  })),
};

/** Local fixture only; no event check-in, wallet or inventory request is made. */
export function ChristmasEventPreview({ popup = false }: { popup?: boolean }) {
  const { entry } = useLocalSearchParams<{ entry?: string | string[] }>();
  const { height } = useWindowDimensions();
  const [visible, setVisible] = useState(Boolean(entry));
  const [stage, setStage] = useState<'attendance' | 'popup'>(popup ? 'popup' : 'attendance');
  const [background, setBackground] = useState<'room' | 'gacha'>('room');
  const [status, setStatus] = useState(FIXTURE_STATUS);
  const [result, setResult] = useState<AttendanceCheckInResult | null>(null);
  const nextStage = useRef<'attendance' | 'popup' | 'gacha' | null>(null);
  const autoPopup = useRef(!popup);
  const popupDismissed = useRef(false);
  const close = () => setVisible(false);
  const open = () => {
    setResult(null);
    setStage(popup ? 'popup' : 'attendance');
    setVisible(true);
  };
  const dismissed = (closed: 'attendance' | 'popup') => {
    if (stage !== closed) return;
    const next =
      nextStage.current ??
      (closed === 'attendance' && autoPopup.current && !popupDismissed.current ? 'popup' : null);
    nextStage.current = null;
    autoPopup.current = false;
    if (next === 'gacha') setBackground('gacha');
    else if (next) {
      setStage(next);
      setResult(null);
      setVisible(true);
    }
  };
  return (
    <View style={{ height, alignSelf: 'stretch' }}>
      {background === 'room' ? (
        <RoomQuickTodoPreview />
      ) : (
        <GachaPhonePreview initialMachineId={CHRISTMAS_PREVIEW.machine.id} />
      )}
      {!visible ? (
        <View style={styles.launch}>
          <Button label={popup ? '크리스마스 안내 열기' : '크리스마스 출석 열기'} onPress={open} />
        </View>
      ) : null}
      <ChristmasEventPopup
        visible={stage === 'popup' && visible}
        title="크리스마스"
        endsOn={status.endsOn}
        onClose={(permanent) => {
          if (permanent) popupDismissed.current = true;
          close();
        }}
        onDismissed={() => dismissed('popup')}
        onGoEvent={(permanent) => {
          if (permanent) popupDismissed.current = true;
          nextStage.current = 'gacha';
          close();
        }}
      />
      <ChristmasAttendanceModal
        visible={stage === 'attendance' && visible}
        status={status}
        result={result}
        onClose={close}
        onDismissed={() => dismissed('attendance')}
        onRetry={() => undefined}
        onGoGacha={() => {
          nextStage.current = 'gacha';
          close();
        }}
        onCheckIn={() => {
          if (status.checkedInToday) return;
          const next = {
            ...status,
            progressDays: 1,
            currentStreak: 1,
            checkedInToday: true,
            availableToday: false,
          };
          setStatus(next);
          setResult({
            newCheckIn: true,
            coinRewardAmount: status.dailyRewards[0].coinAmount,
            coinBalance: 0,
            rewardGrantedNow: false,
            status: next,
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  launch: { position: 'absolute', bottom: Spacing.four, alignSelf: 'center' },
});
