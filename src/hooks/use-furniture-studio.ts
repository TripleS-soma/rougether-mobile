import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import {
  createFurniture,
  FURNITURE_GENERATION_COIN_COST,
  fetchFurnitureCredits,
  fetchFurnitureJobs,
  isFurnitureJobActive,
  type FurniturePhoto,
} from '@/api/furniture-generation';
import { fetchWallets } from '@/api/me';
import { getSessionUserId } from '@/api/auth';
import { toWallet } from '@/api/adapters';
import { queryKeys } from '@/lib/query-keys';
import { ApiError } from '@/api/http';
import { i18n } from '@/i18n';

// An idempotency identifier, not an authentication credential.
function requestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const codes = [
      'FURNITURE_CREDITS_REQUIRED',
      'FURNITURE_GENERATION_UNAVAILABLE',
      'FURNITURE_DAILY_LIMIT',
      'FURNITURE_JOB_IN_PROGRESS',
      'FURNITURE_PHOTO_INVALID',
      // 거래소에 상장된 가구는 재검수를 받을 수 없다 (#1427).
      'FURNITURE_MARKET_LISTED',
    ];
    if (error.code && codes.includes(error.code)) {
      return i18n.t(`roomShop.studio.error.${error.code}`);
    }
    if (error.status === 413) return i18n.t('roomShop.studio.error.tooLarge');
  }
  return i18n.t('roomShop.studio.error.network');
}

type StudioData = Awaited<ReturnType<typeof fetchStudio>>;
const NO_JOBS: StudioData['jobs'] = [];

async function fetchStudio() {
  const [balance, jobs] = await Promise.all([fetchFurnitureCredits(), fetchFurnitureJobs()]);
  return { balance, jobs };
}

export function useFurnitureStudio() {
  const queryClient = useQueryClient();
  const userId = getSessionUserId();
  const queryKey = useMemo(() => queryKeys.furnitureStudio(userId), [userId]);
  const walletKey = useMemo(() => queryKeys.wallet(userId), [userId]);
  const [photo, setPhoto] = useState<FurniturePhoto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const pendingId = useRef(requestId());
  const {
    data,
    isPending,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: fetchStudio,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const {
    data: wallet,
    isPending: walletPending,
    error: walletError,
    refetch: refetchWallet,
  } = useQuery({
    queryKey: walletKey,
    queryFn: async () => toWallet(await fetchWallets()),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { mutateAsync } = useMutation({
    mutationKey: queryKey,
    mutationFn: ({ selectedPhoto, id }: { selectedPhoto: FurniturePhoto; id: string }) =>
      createFurniture(selectedPhoto, id),
    retry: false,
  });
  const balance = data?.balance ?? null;
  const jobs = data?.jobs ?? NO_JOBS;
  const coinBalance = walletError ? null : (wallet?.coin ?? null);
  const loading = isPending || ((balance?.available ?? 0) < 1 && walletPending);
  const queryError = loadError ?? ((balance?.available ?? 0) < 1 ? walletError : null);
  const error = localError ?? (queryError ? errorMessage(queryError) : null);

  const refresh = useCallback(async () => {
    setError(null);
    await Promise.all([refetch(), refetchWallet()]);
  }, [refetch, refetchWallet]);

  useEffect(() => {
    mounted.current = true;
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
        setError(i18n.t('roomShop.studio.error.wrongType'));
        return;
      }
      if (asset.fileSize != null && asset.fileSize > 10 * 1024 * 1024) {
        setError(i18n.t('roomShop.studio.error.tooLarge'));
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
      if (mounted.current) setError(i18n.t('roomShop.studio.error.openFailed'));
    }
  }, []);

  const submit = useCallback(async () => {
    const canAfford =
      (balance?.available ?? 0) > 0 || (coinBalance ?? 0) >= FURNITURE_GENERATION_COIN_COST;
    if (busy.current || !photo || !balance || !canAfford || active) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    // Cancel older reads before reserving a credit or coins.
    try {
      await Promise.all([
        queryClient.cancelQueries({ queryKey }),
        queryClient.cancelQueries({ queryKey: walletKey }),
      ]);
      const job = await mutateAsync({ selectedPhoto: photo, id: pendingId.current });
      if (!mounted.current) return;
      queryClient.setQueryData<StudioData>(
        queryKey,
        (previous) =>
          previous && {
            ...previous,
            jobs: [job, ...previous.jobs.filter((j) => j.id !== job.id)],
          },
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.walletHistory(userId) });
      setPhoto(null);
      pendingId.current = requestId();
      await refresh();
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
      // Keep the photo and request ID: a lost response must not charge twice.
    } finally {
      busy.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }, [
    active,
    balance,
    coinBalance,
    photo,
    queryClient,
    queryKey,
    walletKey,
    mutateAsync,
    refresh,
    userId,
  ]);

  return useMemo(
    () => ({
      balance,
      coinBalance,
      jobs,
      photo,
      loading,
      submitting,
      error,
      choosePhoto,
      submit,
      refresh,
    }),
    [balance, coinBalance, jobs, photo, loading, submitting, error, choosePhoto, submit, refresh],
  );
}
