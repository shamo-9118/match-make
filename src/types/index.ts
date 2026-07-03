export type GameFormat = 'singles' | 'doubles';

export type Gender = 'male' | 'female' | null;

// ペア構成の種類（団体戦用）
export type PairType = 'mens' | 'womens' | 'mixed' | 'singles';

export interface User {
  id: string;
  name: string;
  imagePath?: string;
  color: string; // アバターカラー（写真未設定時に使用）
  gender: Gender;
  // 個人戦セッション内カウント（個人戦リセットでクリア）
  totalPlayCount: number;
  totalRestCount: number;
  pairHistory: Record<string, number>;          // ペア相手ID → 同ペア回数
  opponentHistory: Record<string, number>;      // 対戦相手ID → 対戦回数
  // 団体戦専用統計（複数セッションをまたいで累積、独立してリセット可能）
  teamBattlePairHistory: Record<string, number>;     // ペア相手ID → 同ペア回数
  teamBattleOpponentHistory: Record<string, number>; // 対戦相手ID → 対戦回数
}

// チーム（名前・ロゴのみ永続保存、メンバー編成はセッションごとに設定）
export interface Team {
  id: string;
  name: string;
  logoPath?: string;
}

// 団体戦の1試合
export interface TeamBattleMatch {
  matchNumber: number;   // 全体の試合番号（1始まり）
  courtNumber: number;   // 担当コート番号
  pairType: PairType;
  pairA: { playerIds: string[]; teamId: string }; // チームAのペア
  pairB: { playerIds: string[]; teamId: string }; // チームBのペア
  winnerTeamId?: string | null; // 勝利チームID（未記録は undefined、結果なしスキップは null）
}

// 団体戦セッション
export interface TeamBattleSession {
  id: string;
  date: string;
  courtCount: number;
  teamA: Team & { memberIds: string[] };
  teamB: Team & { memberIds: string[] };
  matches: TeamBattleMatch[];
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
