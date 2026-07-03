'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Team } from '@/types';
import { generateId } from '@/utils/id';

interface TeamStore {
  teams: Team[];
  addTeam: (name: string) => Team;
  updateTeam: (id: string, updates: Partial<Pick<Team, 'name' | 'logoPath'>>) => void;
  deleteTeam: (id: string) => void;
}

export const useTeamStore = create<TeamStore>()(
  persist(
    (set, get) => ({
      teams: [],

      addTeam: (name) => {
        const team: Team = { id: generateId(), name };
        set({ teams: [...get().teams, team] });
        return team;
      },

      updateTeam: (id, updates) => {
        set({ teams: get().teams.map((t) => (t.id === id ? { ...t, ...updates } : t)) });
      },

      deleteTeam: (id) => {
        set({ teams: get().teams.filter((t) => t.id !== id) });
      },
    }),
    { name: 'match-make:teams' }
  )
);
