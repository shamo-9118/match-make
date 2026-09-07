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
        const current = get().locations;
        const localMap = new Map(current.map((l) => [l.id, l]));
        const updated = [...current];

        for (const rl of remote) {
          const existing = localMap.get(rl.id);
          if (!existing) {
            updated.push(rl);
          } else if (existing.name !== rl.name) {
            const idx = updated.findIndex((l) => l.id === rl.id);
            updated[idx] = { ...existing, name: rl.name };
          }
        }

        set({ locations: updated });
      },
    }),
    {
      name: 'match-make:locations',
      version: 1,
    }
  )
);
