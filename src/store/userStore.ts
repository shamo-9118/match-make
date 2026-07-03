'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { pickColor } from '@/utils/colors';

interface UserStore {
  users: User[];
  addUser: (user: Omit<User, 'color' | 'gender' | 'totalPlayCount' | 'totalRestCount' | 'pairHistory' | 'opponentHistory' | 'teamBattlePairHistory' | 'teamBattleOpponentHistory'>) => void;
  updateUser: (id: string, updates: Partial<Pick<User, 'name' | 'imagePath' | 'color' | 'gender'>>) => void;
  deleteUser: (id: string) => void;
  updateUserStats: (updatedUsers: User[]) => void;
  resetAllStats: () => void;
  resetTeamBattleStats: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      users: [],

      addUser: (user) => {
        const newUser: User = {
          ...user,
          color: pickColor(get().users),
          gender: null,
          totalPlayCount: 0,
          totalRestCount: 0,
          pairHistory: {},
          opponentHistory: {},
          teamBattlePairHistory: {},
          teamBattleOpponentHistory: {},
        };
        set({ users: [...get().users, newUser] });
      },

      updateUser: (id, updates) => {
        set({ users: get().users.map((u) => (u.id === id ? { ...u, ...updates } : u)) });
      },

      deleteUser: (id) => {
        set({ users: get().users.filter((u) => u.id !== id) });
      },

      updateUserStats: (updatedUsers) => {
        set({
          users: get().users.map((u) => {
            const updated = updatedUsers.find((uu) => uu.id === u.id);
            return updated ?? u;
          }),
        });
      },

      resetAllStats: () => {
        set({
          users: get().users.map((u) => ({
            ...u,
            totalPlayCount: 0,
            totalRestCount: 0,
            pairHistory: {},
            opponentHistory: {},
          })),
        });
      },

      resetTeamBattleStats: () => {
        set({
          users: get().users.map((u) => ({
            ...u,
            teamBattlePairHistory: {},
            teamBattleOpponentHistory: {},
          })),
        });
      },
    }),
    {
      name: 'match-make:users',
      version: 2,
      migrate: (persistedState: unknown) => {
        const state = persistedState as { users: User[] };
        const migratedUsers: User[] = [];
        for (const u of state.users) {
          migratedUsers.push({
            ...u,
            color: u.color ?? pickColor(migratedUsers),
            gender: u.gender ?? null,
            teamBattlePairHistory: u.teamBattlePairHistory ?? {},
            teamBattleOpponentHistory: u.teamBattleOpponentHistory ?? {},
          });
        }
        return { ...state, users: migratedUsers };
      },
    }
  )
);
