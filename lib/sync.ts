import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

import { Config } from '@/constants/Config';
import {
  applyRemote,
  getDirtyTransactions,
  getKv,
  markAllDirty,
  markClean,
  removeKv,
  setKv,
} from './db';
import type { Transaction } from './types';

/**
 * Anonymous cloud backup to Neon through the Omega API (backend/).
 * No account: the device holds a random 256-bit secret in the iOS Keychain.
 * The server only stores a SHA-256 hash of it, so the secret never leaves the device in clear at rest.
 */

const SECRET_KEY = 'omega.device_secret.v1';
const KV_ENABLED = 'sync.enabled';
const KV_CURSOR = 'sync.cursor';
const KV_LAST = 'sync.last_success';

export function isCloudAvailable(): boolean {
  return Config.apiUrl.length > 0;
}

async function getDeviceSecret(): Promise<string> {
  const existing = await SecureStore.getItemAsync(SECRET_KEY);
  if (existing) return existing;
  const bytes = Crypto.getRandomBytes(32);
  const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(SECRET_KEY, secret, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return secret;
}

export async function isSyncEnabled(): Promise<boolean> {
  if (!isCloudAvailable()) return false;
  return (await getKv(KV_ENABLED)) === '1';
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  await setKv(KV_ENABLED, enabled ? '1' : '0');
  await removeKv(KV_CURSOR);
  if (enabled) await markAllDirty();
}

export async function getLastSync(): Promise<string | null> {
  return getKv(KV_LAST);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const secret = await getDeviceSecret();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${Config.apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface SyncResponse {
  cursor: string;
  hasMore: boolean;
  rows: Transaction[];
}

let running: Promise<{ pushed: number; pulled: number }> | null = null;

/** Pushes local changes, then pulls remote changes since the last cursor. */
export function syncNow(): Promise<{ pushed: number; pulled: number }> {
  if (running) return running;
  running = (async () => {
    let pushed = 0;
    let pulled = 0;
    // Loop while there are more than 500 pending changes or more than one page to pull.
    for (let i = 0; i < 20; i++) {
      const dirty = await getDirtyTransactions(500);
      const cursor = (await getKv(KV_CURSOR)) ?? null;
      const res = await api<SyncResponse>('/api/sync', {
        method: 'POST',
        body: JSON.stringify({ cursor, changes: dirty }),
      });
      await markClean(dirty.map((t) => ({ id: t.id, updatedAt: t.updatedAt })));
      pulled += await applyRemote(res.rows);
      pushed += dirty.length;
      await setKv(KV_CURSOR, res.cursor);
      if (dirty.length < 500 && !res.hasMore) break;
    }
    await setKv(KV_LAST, new Date().toISOString());
    return { pushed, pulled };
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Deletes every row stored in Neon for this device. Local data is untouched. */
export async function deleteCloudData(): Promise<void> {
  await api<{ deleted: number }>('/api/account', { method: 'DELETE' });
  await removeKv(KV_CURSOR);
  await removeKv(KV_LAST);
}
