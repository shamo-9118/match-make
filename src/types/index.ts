export type GameFormat = 'singles' | 'doubles';

export interface User {
  id: string;
  name: string;
  imagePath?: string;
  // セッション内カウント（練習終了でリセット）
  totalPlayCount: number;
  totalRestCount: number;
  pairHistory: Record<string, number>;     // ペア相手ID → 同ペア回数
  opponentHistory: Record<string, number>; // 対戦相手ID → 対戦回数
}

export interface Court {
  courtNumber: number;
  teamA: string[]; // ダブルス: 2人 / シングルス: 1人（ユーザーID）
  teamB: string[]; // ダブルス: 2人 / シングルス: 1人（ユーザーID）
}

export interface Round {
  index: number;
  courts: Court[];
  restingPlayerIds: string[];
}

export interface Session {
  id: string;
  date: string; // ISO string
  courtCount: number;
  gameFormat: GameFormat;
  participantIds: string[];
  rounds: Round[];
  currentRoundIndex: number; // 表示中のラウンドインデックス（閲覧用）
  latestRoundIndex: number;  // 確定済み最新ラウンドインデックス
  nextRound?: Round;         // バックグラウンド計算済みの次ラウンド
}
