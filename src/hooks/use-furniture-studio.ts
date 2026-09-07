import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import {
  createFurniture,
  fetchFurnitureCredits,
  fetchFurnitureJobs,
  isFurnitureJobActive,
  type FurnitureCreditBalance,
  type FurnitureJob,
  type FurniturePhoto,
} from '@/api/furniture-generation';
import { ApiError } from '@/api/http';

// An idempotency identifier, not an authentication credential.
function requestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      FURNITURE_CREDITS_REQUIRED: '생성권이 부족해요. 출석 이벤트에서 생성권을 받아보세요.',
      FURNITURE_GENERATION_UNAVAILABLE:
        '가구 만들기를 잠시 쉬고 있어요. 잠시 후 다시 이용해주세요.',
      FURNITURE_DAILY_LIMIT: '오늘 만들 수 있는 횟수를 모두 사용했어요. 내일 다시 만나요.',
      FURNITURE_JOB_IN_PROGRESS: '만들고 있는 가구가 있어요. 완료되면 새로 만들 수 있어요.',
      FURNITURE_PHOTO_INVALID: '가구가 잘 보이는 JPG 또는 PNG 사진을 선택해주세요.',
    };
    if (error.code && messages[error.code]) return messages[error.code];
    if (error.status === 413) return '10MB 이하의 사진을 선택해주세요.';
  }
  return '연결을 확인하고 다시 시도해주세요.';
}

export function useFurnitureStudio() {
  const [balance, setBalance] = useState<FurnitureCreditBalance | null>(null);
  const [jobs, setJobs] = useState<FurnitureJob[]>([]);
  const [photo, setPhoto] = useState<FurniturePhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const pendingId = useRef(requestId());
  const refreshSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const [nextBalance, nextJobs] = await Promise.all([
        fetchFurnitureCredits(),
        fetchFurnitureJobs(),
      ]);
      if (!mounted.current || sequence !== refreshSequence.current) return;
      setBalance(nextBalance);
      setJobs(nextJobs);
      setError(null);
    } catch (e) {
      if (mounted.current && sequence === refreshSequence.current) setError(errorMessage(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !busy.current) void refresh();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [refresh]);

  const active = jobs.some(isFurnitureJobActive);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'background' && !busy.current) void refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [active, refresh]);

  const choosePhoto = useCallback(async () => {
    if (busy.current) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0] || !mounted.current) return;
      const asset = result.assets[0];
      const type = asset.mimeType ?? 'image/jpeg';
      if (!['image/jpeg', 'image/png'].includes(type)) {
        setError('JPG 또는 PNG 사진을 선택해주세요.');
        return;
      }
      if (asset.fileSize != null && asset.fileSize > 10 * 1024 * 1024) {
        setError('10MB 이하의 사진을 선택해주세요.');
        return;
      }
      setPhoto({
        uri: asset.uri,
        name: type === 'image/png' ? 'furniture.png' : 'furniture.jpg',
        type,
      });
      pendingId.current = requestId();
      setError(null);
    } catch {
      if (mounted.current) setError('사진을 열지 못했어요. 사진 접근 설정을 확인해주세요.');
    }
  }, []);

  const submit = useCallback(async () => {
    if (busy.current || !photo || !balance || balance.available < 1 || active) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    // Invalidate any older reads before reserving a credit.
    refreshSequence.current += 1;
    try {
      const job = await createFurniture(photo, pendingId.current);
      if (!mounted.current) return;
      setJobs((previous) => [job, ...previous.filter((j) => j.id !== job.id)]);
      setPhoto(null);
      pendingId.current = requestId();
      await refresh();
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
      // Keep the photo and request ID: a lost response must not spend a second credit.
    } finally {
      busy.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }, [active, balance, photo, refresh]);

  return { balance, jobs, photo, loading, submitting, error, choosePhoto, submit, refresh };
}
