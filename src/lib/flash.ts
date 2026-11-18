'use client';

import { useEffect, useState } from 'react';

type Listener = (value: string | null) => void;
type Entry = { value: string; at: number };

const FRESH_MS = 15_000;

const values = new Map<string, Entry>();
const listeners = new Map<string, Set<Listener>>();

/**
 * Module-level flash messages survive the RSC remount triggered by
 * requestRefresh(), so an action's result is still visible afterwards.
 * Entries expire so a later visit does not replay an old message.
 */
export const setFlash = (key: string, value: string | null) => {
  if (value === null) {
    values.delete(key);
  } else {
    values.set(key, { value, at: Date.now() });
  }
  listeners.get(key)?.forEach((listener) => {
    listener(value);
  });
};

const takeFresh = (key: string): string | null => {
  const entry = values.get(key);
  if (!entry) return null;
  values.delete(key);
  return Date.now() - entry.at <= FRESH_MS ? entry.value : null;
};

export const useFlash = (key: string) => {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    let bucket = listeners.get(key);
    if (!bucket) {
      bucket = new Set();
      listeners.set(key, bucket);
    }
    bucket.add(setValue);

    const fresh = takeFresh(key);
    if (fresh) {
      setValue(fresh);
    }

    return () => {
      bucket?.delete(setValue);
    };
  }, [key]);

  return [value, (next: string | null) => setFlash(key, next)] as const;
};
