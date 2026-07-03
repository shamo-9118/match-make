'use client';
import { create } from 'zustand';
import { TeamBattleSession, TeamBattleMatch, Team } from '@/types';

interface TeamBattleSessionStore {
  session: TeamBattleSession | null;
  startSession: (
    teamA: Team & { memberIds: string[] },
    teamB: Team & { memberIds: string[] },
    matches: TeamBattleMatch[],
    courtCount: number,
  ) => void;
  recordResult: (matchNumber: number, winnerTeamId: string | null | undefined) => void;
  endSession: () => void;
}

export const useTeamBattleSessionStore = create<TeamBattleSessionStore>((set, get) => ({
  session: null,

  startSession: (teamA, teamB, matches, courtCount) => {
    set({
      session: {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        courtCount,
        teamA,
        teamB,
        matches,
      },
    });
  },

  recordResult: (matchNumber, winnerTeamId) => {
    const { session } = get();
    if (!session) return;
    set({
      session: {
        ...session,
        matches: session.matches.map((m) =>
          m.matchNumber === matchNumber ? { ...m, winnerTeamId } : m
        ),
      },
    });
  },

  endSession: () => set({ session: null }),
}));
