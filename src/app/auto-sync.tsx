'use client';
import { useEffect } from 'react';
import { startAutoSync } from '@/lib/sync';

export function AutoSync() {
  useEffect(() => {
    startAutoSync();
  }, []);
  return null;
}
