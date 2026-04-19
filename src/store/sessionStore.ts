import { create } from 'zustand';
import { Session, Round, GameFormat } from '../types';

interface SessionStore {
  session: Session | null;
  startSession: (courtCount: number, gameFormat: GameFormat, participantIds: string[]) => void;
  setNextRound: (round: Round) => void;
  confirmNextRound: () => void; // 「次へ」押下: カウント更新は呼び出し元が行う
  goBack: () => void;
  goToLatest: () => void;
  updateParticipants: (participantIds: string[]) => void;
  endSession: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,

  startSession: (courtCount, gameFormat, participantIds) => {
    const session: Session = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      courtCount,
      gameFormat,
      participantIds,
      rounds: [],
      currentRoundIndex: -1,
      latestRoundIndex: -1,
    };
    set({ session });
  },

  // バックグラウンドで計算した次ラウンドをセット
  setNextRound: (round) => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, nextRound: round } });
  },

  // 「次へ」押下時: 事前計算済みラウンドを確定
  confirmNextRound: () => {
    const { session } = get();
    if (!session?.nextRound) return;

    const newRound = session.nextRound;
    const newRounds = [...session.rounds, newRound].slice(-50); // 最大50件
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
    set({
      session: { ...session, currentRoundIndex: session.currentRoundIndex - 1 },
    });
  },

  goToLatest: () => {
    const { session } = get();
    if (!session) return;
    set({
      session: { ...session, currentRoundIndex: session.latestRoundIndex },
    });
  },

  updateParticipants: (participantIds) => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, participantIds } });
  },

  endSession: () => set({ session: null }),
}));
