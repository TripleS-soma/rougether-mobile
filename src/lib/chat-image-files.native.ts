import * as FileSystem from 'expo-file-system/legacy';

import { API_BASE } from '@/api/config';

// Private app cache only: no photo-library permission, backup, or token-bearing filenames.
const MAX_CACHE_BYTES = 128 * 1024 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const environment = encodeURIComponent(API_BASE);
const root = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}chat-photos-v1/${environment}/`
  : null;
let generation = 0;
const activeDownloads = new Set<string>();
let sweptUser: number | undefined;
let lastSweepAt = 0;
let reservedDownloadBytes = 0;
let downloading = 0;
const downloadWaiters: (() => void)[] = [];

async function withDownloadSlot<T>(action: () => Promise<T>): Promise<T> {
  if (downloading >= 2) await new Promise<void>((resolve) => downloadWaiters.push(resolve));
  else downloading += 1;
  try {
    return await action();
  } finally {
    const next = downloadWaiters.shift();
    if (next) next();
    else downloading -= 1;
  }
}
let mutations: Promise<unknown> = Promise.resolve();

function serial<T>(action: () => Promise<T>): Promise<T> {
  const next = mutations.then(action, action);
  mutations = next.catch(() => {});
  return next;
}

async function remove(uri: string) {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

/** Remove expired files, old-account files and oldest files over the disk budget. */
async function prune(userId: number, reservedBytes = reservedDownloadBytes) {
  if (!root) return;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  const directory = `${root}${userId}/`;
  for (const name of await FileSystem.readDirectoryAsync(root)) {
    if (name !== String(userId)) await remove(`${root}${name}`);
  }
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const files: { uri: string; bytes: number; modified: number }[] = [];
  for (const name of await FileSystem.readDirectoryAsync(directory)) {
    const uri = `${directory}${name}`;
    // In-flight partial downloads are cleaned by their owner, never by another reader.
    if (name.endsWith('.part') && activeDownloads.has(uri)) continue;
    const match = /^(\d+)-(\d+)\.jpg$/.exec(name);
    const info = await FileSystem.getInfoAsync(uri);
    if (!match || Number(match[2]) <= Date.now() || !info.exists || info.isDirectory) {
      await remove(uri);
    } else {
      files.push({ uri, bytes: info.size, modified: info.modificationTime });
    }
  }
  let bytes = files.reduce((sum, file) => sum + file.bytes, 0) + reservedBytes;
  for (const file of files.sort((a, b) => a.modified - b.modified)) {
    if (bytes <= MAX_CACHE_BYTES) break;
    await remove(file.uri);
    bytes -= file.bytes;
  }
}

export async function loadChatImageFile(
  userId: number,
  imageId: number,
  expiresAt: string,
  url: string,
  token: string,
  assertCurrent: () => void,
): Promise<string | null> {
  if (!root) return null;
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return null;
  const started = generation;
  const current = () => {
    assertCurrent();
    if (started !== generation || Date.now() >= expiry)
      throw new Error('Chat photo expired or session changed');
  };
  const directory = `${root}${userId}/`;
  const target = `${directory}${imageId}-${expiry}.jpg`;
  const cached = await serial(async () => {
    current();
    if (sweptUser !== userId || Date.now() - lastSweepAt > 60000) {
      await prune(userId);
      sweptUser = userId;
      lastSweepAt = Date.now();
    }
    const info = await FileSystem.getInfoAsync(target);
    current();
    return info.exists && !info.isDirectory && info.size > 0;
  });
  if (cached) return target;
  return withDownloadSlot(async () => {
    current();
    const temporary = `${directory}${imageId}-${Date.now()}-${Math.random().toString(36).slice(2)}.part`;
    let reserved = false;
    try {
      await serial(async () => {
        current();
        await prune(userId, reservedDownloadBytes + MAX_FILE_BYTES);
        // The OS may reclaim this cache directory between reads.
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        reservedDownloadBytes += MAX_FILE_BYTES;
        reserved = true;
      });
      activeDownloads.add(temporary);
      const response = await FileSystem.downloadAsync(url, temporary, {
        headers: { Authorization: `Bearer ${token}` },
        cache: false,
      });
      current();
      if (response.status !== 200) throw new Error('Chat photo download failed');
      const info = await FileSystem.getInfoAsync(temporary);
      if (!info.exists || info.isDirectory || info.size <= 0 || info.size > MAX_FILE_BYTES)
        throw new Error('Chat photo cache file invalid');
      await serial(async () => {
        current();
        await prune(userId, reservedDownloadBytes - MAX_FILE_BYTES + info.size);
        await remove(target);
        await FileSystem.moveAsync({ from: temporary, to: target });
        current();
      });
      return target;
    } finally {
      activeDownloads.delete(temporary);
      await remove(temporary).catch(() => {});
      if (reserved) reservedDownloadBytes -= MAX_FILE_BYTES;
    }
  });
}

export async function removeChatImageFile(userId: number, imageId: number): Promise<void> {
  if (!root) return;
  await serial(async () => {
    const directory = `${root}${userId}/`;
    if (!(await FileSystem.getInfoAsync(directory)).exists) return;
    for (const name of await FileSystem.readDirectoryAsync(directory)) {
      if (name.startsWith(`${imageId}-`) && name.endsWith('.jpg'))
        await remove(`${directory}${name}`);
    }
  });
}

export async function clearChatImageFiles(): Promise<void> {
  sweptUser = undefined;
  lastSweepAt = 0;
  generation += 1; // Reject late downloads before scheduling filesystem deletion.
  if (root) await serial(() => remove(root));
}

/** Called on foreground too, so expired files are cleaned without opening another photo. */
export async function sweepChatImageFiles(userId: number): Promise<void> {
  await serial(async () => {
    await prune(userId);
    sweptUser = userId;
    lastSweepAt = Date.now();
  });
}
