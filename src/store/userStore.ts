'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface UserStore {
  users: User[];
  addUser: (user: Omit<User, 'totalPlayCount' | 'totalRestCount' | 'pairHistory' | 'opponentHistory'>) => void;
  updateUser: (id: string, updates: Partial<Pick<User, 'name' | 'imagePath'>>) => void;
  deleteUser: (id: string) => void;
  updateUserStats: (updatedUsers: User[]) => void;
  resetAllStats: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      users: [],

      addUser: (user) => {
        const newUser: User = {
          ...user,
          totalPlayCount: 0,
          totalRestCount: 0,
          pairHistory: {},
          opponentHistory: {},
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
    }),
    { name: 'match-make:users' }
  )
);
