/**
 * 피드 게시물 작성 (#1409) — 사진은 고르는 즉시 한 장씩 올리고(POST /feed/images), 전부
 * 올라가면 imageId 순서대로 게시한다(POST /feed/posts).
 *
 * 재시도 규칙(spec): 같은 등록 작업의 재시도는 **같은 clientPostId**. 응답을 잃은 게시
 * 요청을 다시 보내도 글이 두 개 생기지 않는다. 본문·사진을 바꿔 다시 보내면 서버가 같은
 * id를 409로 거부하므로 그때는 새 id를 만든다. 업로드는 멱등하지 않아 받은 imageId를
 * 재사용하고, 실패한 장만 다시 올린다.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';

import { getSessionUserId } from '@/api/auth';
import { createFeedPost, deleteFeedImage, type FeedUploadFile, uploadFeedImage } from '@/api/feed';
import type { FeedDraftImage, FeedPost } from '@/components/screens/feed/types';
import {
  FEED_IMAGE_TYPES,
  FEED_MAX_CONTENT,
  FEED_MAX_IMAGE_BYTES,
  FEED_MAX_IMAGES,
} from '@/constants/feed';
import { feedErrorMessage, newFeedClientId } from '@/hooks/feed-cache';
import { useLatestRef } from '@/hooks/use-stable-value';
import { i18n } from '@/i18n';
import { track } from '@/lib/analytics';
import type { PickedLibraryImageWithSize } from '@/lib/pick-image';
import { queryKeys } from '@/lib/query-keys';

const NO_IMAGES: FeedDraftImage[] = [];

/** 고른 사진이 서버 조건(JPEG/PNG · 10MiB)에 맞지 않으면 안내 문구, 맞으면 null. */
export function feedImageRejection(file: PickedLibraryImageWithSize): string | null {
  if (!FEED_IMAGE_TYPES.includes(file.type.toLowerCase())) return i18n.t('feed.compose.badType');
  if (file.fileSize != null && file.fileSize > FEED_MAX_IMAGE_BYTES)
    return i18n.t('feed.compose.tooLarge');
  return null;
}

export function useFeedCompose({ onError }: { onError?: (message: string) => void } = {}) {
  const qc = useQueryClient();
  const userId = getSessionUserId();
  const onErrorRef = useLatestRef(onError);
  const [images, setImages] = useState<FeedDraftImage[]>(NO_IMAGES);
  const [content, setContentState] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { mutateAsync: uploadAsync } = useMutation({ mutationFn: uploadFeedImage });
  const { mutateAsync: createAsync } = useMutation({ mutationFn: createFeedPost });

  // 재시도용 원본 파일 — 상태에 두면 렌더마다 비교할 필요 없는 값이 섞인다.
  const files = useRef(new Map<string, FeedUploadFile>());
  const seq = useRef(0);
  const imagesRef = useLatestRef(images);
  const submittingRef = useRef(false);
  /** 마지막 게시 시도의 id와 내용 서명 — 내용이 같을 때만 id를 재사용한다. */
  const attempt = useRef<{ id: string; signature: string } | null>(null);

  const patchImage = useCallback((key: string, patch: Partial<FeedDraftImage>) => {
    setImages((prev) => prev.map((img) => (img.key === key ? { ...img, ...patch } : img)));
  }, []);

  const upload = useCallback(
    async (key: string) => {
      const file = files.current.get(key);
      if (!file) return;
      patchImage(key, { status: 'uploading', error: undefined });
      try {
        const res = await uploadAsync(file);
        // 올리는 사이에 뺀 사진이면 서버 업로드도 바로 취소한다(30장 한도에서 빠지게).
        if (!files.current.has(key)) {
          if (res.imageId != null) void deleteFeedImage(res.imageId).catch(() => {});
          return;
        }
        if (res.imageId == null) throw new Error('upload without imageId');
        patchImage(key, { status: 'done', imageId: res.imageId });
      } catch (err) {
        if (files.current.has(key)) {
          patchImage(key, { status: 'failed', error: feedErrorMessage(err) });
        }
      }
    },
    [patchImage, uploadAsync],
  );

  /** 고른 사진 추가 — 조건에 안 맞는 장은 안내만 하고 빼고, 나머지는 곧바로 올린다. */
  const addImages = useCallback(
    (picked: PickedLibraryImageWithSize[]) => {
      const room = FEED_MAX_IMAGES - imagesRef.current.length;
      const accepted: FeedDraftImage[] = [];
      let rejection: string | null = null;
      for (const file of picked.slice(0, Math.max(0, room))) {
        const reason = feedImageRejection(file);
        if (reason) {
          rejection ??= reason;
          continue;
        }
        seq.current += 1;
        const key = `draft-${seq.current}`;
        files.current.set(key, { uri: file.uri, name: file.name, type: file.type });
        accepted.push({ key, uri: file.uri, status: 'uploading' });
      }
      if (rejection) onErrorRef.current?.(rejection);
      if (accepted.length === 0) return;
      setImages((prev) => [...prev, ...accepted]);
      for (const img of accepted) void upload(img.key);
    },
    [imagesRef, onErrorRef, upload],
  );

  const retryImage = useCallback((key: string) => void upload(key), [upload]);

  /** 사진 빼기 — 이미 올라간 장은 서버 업로드도 취소한다(게시 전이라 가능). */
  const removeImage = useCallback(
    (key: string) => {
      files.current.delete(key);
      const target = imagesRef.current.find((img) => img.key === key);
      if (target?.imageId != null) void deleteFeedImage(target.imageId).catch(() => {});
      setImages((prev) => prev.filter((img) => img.key !== key));
    },
    [imagesRef],
  );

  const setContent = useCallback((next: string) => {
    setContentState(next.slice(0, FEED_MAX_CONTENT));
  }, []);

  /** 작성 취소 — 올려 둔 사진을 서버에서 지우고 초안을 비운다. */
  const discard = useCallback(() => {
    for (const img of imagesRef.current) {
      if (img.imageId != null) void deleteFeedImage(img.imageId).catch(() => {});
    }
    files.current.clear();
    attempt.current = null;
    setImages(NO_IMAGES);
    setContentState('');
  }, [imagesRef]);

  /** 게시 — 성공하면 새 글, 아니면 null(안내는 onError). */
  const submit = useCallback(async (): Promise<FeedPost | null> => {
    if (submittingRef.current) return null;
    const current = imagesRef.current;
    if (current.length === 0) {
      onErrorRef.current?.(i18n.t('feed.compose.needPhoto'));
      return null;
    }
    if (current.some((img) => img.status !== 'done' || img.imageId == null)) {
      onErrorRef.current?.(i18n.t('feed.compose.waitUpload'));
      return null;
    }
    const imageIds = current.map((img) => img.imageId as number);
    const text = content.trim();
    const signature = JSON.stringify([text, imageIds]);
    if (attempt.current?.signature !== signature) {
      attempt.current = { id: newFeedClientId(), signature };
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const post = await createAsync({
        clientPostId: attempt.current.id,
        content: text || undefined,
        imageIds,
      });
      track('feed_post_create', { image_count: imageIds.length, has_text: text.length > 0 });
      attempt.current = null;
      files.current.clear();
      setImages(NO_IMAGES);
      setContentState('');
      await qc.invalidateQueries({ queryKey: queryKeys.feed.lists(userId) });
      return post;
    } catch (err) {
      onErrorRef.current?.(feedErrorMessage(err));
      return null;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [content, createAsync, imagesRef, onErrorRef, qc, userId]);

  const uploading = images.some((img) => img.status === 'uploading');
  const canSubmit =
    images.length > 0 && !submitting && images.every((img) => img.status === 'done');

  return useMemo(
    () => ({
      images,
      content,
      submitting,
      uploading,
      canSubmit,
      setContent,
      addImages,
      retryImage,
      removeImage,
      discard,
      submit,
    }),
    [
      images,
      content,
      submitting,
      uploading,
      canSubmit,
      setContent,
      addImages,
      retryImage,
      removeImage,
      discard,
      submit,
    ],
  );
}
