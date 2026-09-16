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
    ];
    if (error.code && codes.includes(error.code)) {
      return i18n.t(`roomShop.studio.error.${error.code}`);
    }
    if (error.status === 413) return i18n.t('roomShop.studio.error.tooLarge');
  }
  return i18n.t('roomShop.studio.error.network');
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
