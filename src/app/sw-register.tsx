'use client';
import { useEffect } from 'react';

/** SW 更新チェック間隔（ミリ秒） */
const UPDATE_INTERVAL = 60 * 60 * 1000; // 1時間

export function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // 新しい SW がコントロールを取得したら自動リロード
    // （skipWaiting + clients.claim による即時切替を検知）
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // アプリがフォアグラウンドに戻ったとき更新チェック
        // iPad PWA ではホーム画面から復帰時にここを通る
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update();
          }
        });

        // 定期的な更新チェック（長時間開きっぱなし対策）
        setInterval(() => registration.update(), UPDATE_INTERVAL);
      });
  }, []);
  return null;
}
