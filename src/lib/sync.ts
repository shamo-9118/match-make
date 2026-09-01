import { useUserStore } from '@/store/userStore';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL
  || 'https://script.google.com/macros/s/AKfycbwZa6k7ik7Tf2MgKC0SXvkLTMMvZHMXPdiFxuEDeN37Dg4FYHnztdOsLV6qYa8rwzmBDg/exec';

const SYNC_TS_KEY = 'match-make:last-sync';

function getLastSyncTime(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SYNC_TS_KEY);
}

function setLastSyncTime(iso: string) {
  localStorage.setItem(SYNC_TS_KEY, iso);
}

// Push local unsynced users to GAS sheet
export async function syncToSheet() {
  if (!GAS_URL || !navigator.onLine) return;

  const { getUnsyncedUsers, markSynced } = useUserStore.getState();
  const unsynced = getUnsyncedUsers();
  if (unsynced.length === 0) return;

  const members = unsynced.map((u) => ({
    id: u.id,
    name: u.name,
    gender: u.gender,
    color: u.color,
    createdAt: u.createdAt,
    archived: u.archived,
  }));

  // GAS redirects POST (302), so use no-cors
  await fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ members, matches: [] }),
  });

  // no-cors returns opaque response, assume success
  markSynced(unsynced.map((u) => u.id));
  setLastSyncTime(new Date().toISOString());
}

// Pull users from GAS sheet into local store
export async function pullFromSheet() {
  if (!GAS_URL || !navigator.onLine) return;

  const since = getLastSyncTime();
  const url = since ? `${GAS_URL}?since=${encodeURIComponent(since)}` : GAS_URL;

  const response = await fetch(url);
  if (!response.ok) throw new Error('Pull failed');

  const data = await response.json();
  if (data.members && data.members.length > 0) {
    useUserStore.getState().importUsers(data.members);
  }
  setLastSyncTime(new Date().toISOString());
}

// Full sync: pull then push
export async function fullSync() {
  await pullFromSheet();
  await syncToSheet();
}

export function startAutoSync() {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    fullSync().catch(console.error);
  });

  // Initial sync on load
  if (navigator.onLine) {
    pullFromSheet()
      .then(() => syncToSheet())
      .catch(console.error);
  }
}
