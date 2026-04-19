import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

const STORAGE_KEY = 'match-make:users';

interface UserStore {
  users: User[];
  loadUsers: () => Promise<void>;
  addUser: (user: Omit<User, 'totalPlayCount' | 'totalRestCount' | 'pairHistory' | 'opponentHistory'>) => Promise<void>;
  updateUser: (id: string, updates: Partial<Pick<User, 'name' | 'imagePath'>>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updateUserStats: (updates: User[]) => Promise<void>;
  resetAllStats: () => Promise<void>;
}

const persist = async (users: User[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(users));
};

export const useUserStore = create<UserStore>((set, get) => ({
  users: [],

  loadUsers: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) set({ users: JSON.parse(raw) });
  },

  addUser: async (user) => {
    const newUser: User = {
      ...user,
      totalPlayCount: 0,
      totalRestCount: 0,
      pairHistory: {},
      opponentHistory: {},
    };
    const users = [...get().users, newUser];
    set({ users });
    await persist(users);
  },

  updateUser: async (id, updates) => {
    const users = get().users.map((u) => (u.id === id ? { ...u, ...updates } : u));
    set({ users });
    await persist(users);
  },

  deleteUser: async (id) => {
    const users = get().users.filter((u) => u.id !== id);
    set({ users });
    await persist(users);
  },

  updateUserStats: async (updatedUsers) => {
    const users = get().users.map((u) => {
      const updated = updatedUsers.find((uu) => uu.id === u.id);
      return updated ?? u;
    });
    set({ users });
    await persist(users);
  },

  resetAllStats: async () => {
    const users = get().users.map((u) => ({
      ...u,
      totalPlayCount: 0,
      totalRestCount: 0,
      pairHistory: {},
      opponentHistory: {},
    }));
    set({ users });
    await persist(users);
  },
}));
