'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { pickColor } from '@/utils/colors';

interface UserStore {
  users: User[];
  addUser: (user: Omit<User, 'color' | 'gender' | 'createdAt' | 'synced' | 'archived' | 'source' | 'totalPlayCount' | 'totalRestCount' | 'pairHistory' | 'opponentHistory' | 'teamBattlePairHistory' | 'teamBattleOpponentHistory'>) => void;
  updateUser: (id: string, updates: Partial<Pick<User, 'name' | 'imagePath' | 'color' | 'gender'>>) => void;
  deleteUser: (id: string) => void;
  updateUserStats: (updatedUsers: User[]) => void;
  resetAllStats: () => void;
  resetTeamBattleStats: () => void;
  getActiveUsers: () => User[];
  getUnsyncedUsers: () => User[];
  importUsers: (remoteUsers: Array<{ id: string; name: string; gender: string | null; color: string | null; createdAt: string; archived: boolean }>) => void;
  markSynced: (ids: string[]) => void;
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
          createdAt: new Date().toISOString(),
          synced: false,
          archived: false,
          source: 'local',
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
        set({ users: get().users.map((u) => (u.id === id ? { ...u, ...updates, synced: false } : u)) });
      },

      deleteUser: (id) => {
        set({ users: get().users.map((u) => (u.id === id ? { ...u, archived: true, synced: false } : u)) });
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

      getActiveUsers: () => get().users.filter((u) => !u.archived),

      getUnsyncedUsers: () => get().users.filter((u) => !u.synced),

      importUsers: (remoteUsers) => {
        const current = get().users;
        const localMap = new Map(current.map((u) => [u.id, u]));
        const updated = [...current];

        for (const rm of remoteUsers) {
          const existing = localMap.get(rm.id);
          if (existing && !existing.synced) continue; // ローカル未同期を優先
          const base: User = existing ?? {
            id: rm.id,
            name: rm.name,
            gender: rm.gender as User['gender'],
            color: rm.color ?? pickColor(updated),
            imagePath: undefined,
            createdAt: rm.createdAt,
            synced: true,
            archived: rm.archived ?? false,
            source: 'sheet',
            totalPlayCount: 0,
            totalRestCount: 0,
            pairHistory: {},
            opponentHistory: {},
            teamBattlePairHistory: {},
            teamBattleOpponentHistory: {},
          };
          const merged: User = {
            ...base,
            name: rm.name,
            gender: rm.gender as User['gender'],
            color: rm.color ?? base.color,
            createdAt: rm.createdAt ?? base.createdAt,
            archived: rm.archived ?? false,
            synced: true,
          };
          if (existing) {
            const idx = updated.findIndex((u) => u.id === rm.id);
            updated[idx] = merged;
          } else {
            updated.push(merged);
          }
        }

        set({ users: updated });
      },

      markSynced: (ids) => {
        set({
          users: get().users.map((u) =>
            ids.includes(u.id) ? { ...u, synced: true } : u
          ),
        });
      },
    }),
    {
      name: 'match-make:users',
      version: 4,
      migrate: (persistedState: unknown) => {
        const state = persistedState as { users: User[] };
        const migratedUsers: User[] = [];
        for (const u of state.users) {
          migratedUsers.push({
            ...u,
            color: u.color ?? pickColor(migratedUsers),
            gender: u.gender ?? null,
            createdAt: u.createdAt ?? new Date().toISOString(),
            synced: u.synced ?? false,
            archived: u.archived ?? false,
            source: u.source ?? 'local',
            teamBattlePairHistory: u.teamBattlePairHistory ?? {},
            teamBattleOpponentHistory: u.teamBattleOpponentHistory ?? {},
          });
        }
        return { ...state, users: migratedUsers };
      },
    }
  )
);
