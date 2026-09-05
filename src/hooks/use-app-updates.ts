import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useLatestRef, useStableCallback } from '@/hooks/use-stable-value';
import type { AppUpdateState, AppUpdateStatus } from '@/types/app-update';

type Operation = 'idle' | 'checking' | 'downloading' | 'applying';

/** Native OTA state belongs to Expo's state machine, not the business API query cache. */
export function useAppUpdates() {
  const native = Updates.useUpdates();
  const supported = Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;
  const [operation, setOperation] = useState<Operation>('idle');
  const [result, setResult] = useState<'idle' | 'no-update' | 'error'>('idle');
  const [error, setError] = useState<string>();
  const [downloaded, setDownloaded] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const latest = useLatestRef({ native, downloaded });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const check = useStableCallback(async () => {
    const current = latest.current;
    if (
      !supported ||
      busy.current ||
      current.native.isChecking ||
      current.native.isDownloading ||
      current.native.isRestarting ||
      current.native.isUpdatePending ||
      current.downloaded
    )
      return;
    busy.current = true;
    setError(undefined);
    setOperation('checking');
    let stage: 'check' | 'download' = 'check';
    try {
      const update = await Updates.checkForUpdateAsync();
      if (!mounted.current) return;
      if (update.isAvailable || update.isRollBackToEmbedded) {
        stage = 'download';
        setOperation('downloading');
        const fetched = await Updates.fetchUpdateAsync();
        if (!mounted.current) return;
        if (fetched.isNew || fetched.isRollBackToEmbedded) {
          // Native events may arrive after the promise resolves. Keep the ready action available.
          setDownloaded(true);
          setResult('idle');
        } else {
          setResult('error');
          setError('새 업데이트가 다운로드되지 않았어요. 잠시 후 다시 확인해 주세요.');
        }
      } else if (
        update.reason === Updates.UpdateCheckResultNotAvailableReason.UPDATE_PREVIOUSLY_FAILED
      ) {
        setResult('error');
        setError('이 기기에서 실행에 실패했던 업데이트예요. 안전을 위해 다시 적용하지 않았어요.');
      } else {
        setResult('no-update');
      }
    } catch {
      if (mounted.current) {
        setResult('error');
        setError(
          stage === 'check'
            ? '업데이트를 확인하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.'
            : '다운로드를 완료하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.',
        );
      }
    } finally {
      busy.current = false;
      if (mounted.current) setOperation('idle');
    }
  });

  const apply = useStableCallback(async () => {
    const current = latest.current;
    if (
      !supported ||
      busy.current ||
      current.native.isChecking ||
      current.native.isDownloading ||
      current.native.isRestarting ||
      (!current.downloaded && !current.native.isUpdatePending)
    )
      return;
    busy.current = true;
    setError(undefined);
    setOperation('applying');
    try {
      // This is only called by the explicit restart confirmation, never by a download effect.
      await Updates.reloadAsync();
      // Do not run meaningful work after a successful reload request or unlock a second reload.
    } catch {
      busy.current = false;
      if (mounted.current) {
        setOperation('idle');
        setError(
          '업데이트를 적용하지 못했어요. 다시 시도하거나 앱을 완전히 종료한 뒤 열어 주세요.',
        );
      }
    }
  });

  const status: AppUpdateStatus = !supported
    ? 'unsupported'
    : operation === 'applying' || native.isRestarting
      ? 'applying'
      : operation === 'downloading' || native.isDownloading
        ? 'downloading'
        : operation === 'checking' || native.isChecking
          ? 'checking'
          : downloaded || native.isUpdatePending
            ? 'ready'
            : result;
  const progress = native.downloadProgress;
  const state = useMemo<AppUpdateState>(
    () => ({
      status,
      error,
      progress:
        typeof progress === 'number' && Number.isFinite(progress)
          ? Math.max(0, Math.min(1, progress))
          : undefined,
      info: {
        appVersion: Constants.expoConfig?.version ?? '확인 불가',
        channel: Updates.channel,
        runtimeVersion: Updates.runtimeVersion,
        updateId: Updates.updateId,
        embedded: Updates.isEmbeddedLaunch,
        emergencyLaunch: Updates.isEmergencyLaunch,
      },
    }),
    [status, error, progress],
  );
  return useMemo(() => ({ state, check, apply }), [state, check, apply]);
}
