'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Location {
  id: string;
  name: string;
  createdAt: string;
}

interface LocationStore {
  locations: Location[];
  addLocation: (loc: Location) => void;
  updateLocation: (id: string, name: string) => void;
  deleteLocation: (id: string) => void;
  importLocations: (remote: Location[]) => void;
}

export const useLocationStore = create<LocationStore>()(
  persist(
    (set, get) => ({
      locations: [],

      addLocation: (loc) => {
        const exists = get().locations.some((l) => l.id === loc.id);
        if (exists) return;
        set({ locations: [...get().locations, loc] });
      },

      updateLocation: (id, name) => {
        set({
          locations: get().locations.map((l) =>
            l.id === id ? { ...l, name } : l
          ),
        });
      },

      deleteLocation: (id) => {
        set({ locations: get().locations.filter((l) => l.id !== id) });
      },

      importLocations: (remote) => {
        // リモートデータでローカルを置き換え（IDベースでマージ）
        const mergedMap = new Map<string, Location>();
        // ローカルを先に入れる
        for (const l of get().locations) {
          mergedMap.set(l.id, l);
        }
        // リモートで上書き
        for (const rl of remote) {
          mergedMap.set(rl.id, rl);
        }
        set({ locations: Array.from(mergedMap.values()) });
      },
    }),
    {
      name: 'match-make:locations',
      version: 2,
      migrate: (persistedState: unknown) => {
        const state = persistedState as { locations: Location[] };
        // 重複IDを除去
        const seen = new Map<string, Location>();
        for (const l of state.locations ?? []) {
          seen.set(l.id, l);
        }
        return { ...state, locations: Array.from(seen.values()) };
      },
    }
  )
);
