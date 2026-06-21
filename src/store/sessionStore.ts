'use client';
import { create } from 'zustand';
import { Session, Round, GameFormat } from '@/types';

interface SessionStore {
  session: Session | null;
  startSession: (courtCount: number, gameFormat: GameFormat, participantIds: string[]) => void;
  setNextRound: (round: Round) => void;
  confirmNextRound: () => void;
  goBack: () => void;
  goToLatest: () => void;
  updateParticipants: (participantIds: string[]) => void;
  swapNextRoundPlayers: (idA: string, idB: string) => void;
  endSession: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,

  startSession: (courtCount, gameFormat, participantIds) => {
    set({
      session: {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        courtCount,
        gameFormat,
        participantIds,
        rounds: [],
        currentRoundIndex: -1,
        latestRoundIndex: -1,
      },
    });
  },

  setNextRound: (round) => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, nextRound: round } });
  },

  confirmNextRound: () => {
    const { session } = get();
    if (!session?.nextRound) return;
    const newRounds = [...session.rounds, session.nextRound].slice(-50);
    const newLatest = newRounds.length - 1;
    set({
      session: {
        ...session,
        rounds: newRounds,
        currentRoundIndex: newLatest,
        latestRoundIndex: newLatest,
        nextRound: undefined,
      },
    });
  },

  goBack: () => {
    const { session } = get();
    if (!session || session.currentRoundIndex <= 0) return;
    set({ session: { ...session, currentRoundIndex: session.currentRoundIndex - 1 } });
  },

  goToLatest: () => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, currentRoundIndex: session.latestRoundIndex } });
  },

  updateParticipants: (participantIds) => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, participantIds } });
  },

  swapNextRoundPlayers: (idA, idB) => {
    const { session } = get();
    if (!session?.nextRound) return;
    const next = session.nextRound;
    const newCourts = next.courts.map((court) => ({
      ...court,
      teamA: court.teamA.map((id) => (id === idA ? idB : id === idB ? idA : id)),
      teamB: court.teamB.map((id) => (id === idA ? idB : id === idB ? idA : id)),
    }));
    const newResting = next.restingPlayerIds.map((id) => (id === idA ? idB : id === idB ? idA : id));
    set({ session: { ...session, nextRound: { ...next, courts: newCourts, restingPlayerIds: newResting } } });
  },

  endSession: () => set({ session: null }),
}));
