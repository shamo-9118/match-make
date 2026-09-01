import { User, Court, Round, GameFormat } from '../types';

/** 配列をシャッフル（Fisher-Yates） */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 各参加者が「何ラウンド前に最後に休んだか」を返す。
 * - 過去ラウンドに一度も登場しない（途中参加者）→ 0（直後にプレイさせる）
 * - 一度も休んでいない（開始から出場し続けている）→ pastRounds.length + 1
 */
function getRoundsSinceLastRest(
  userId: string,
  pastRounds: Round[],
): number {
  let everAppeared = false;
  for (let i = pastRounds.length - 1; i >= 0; i--) {
    if (pastRounds[i].restingPlayerIds.includes(userId)) {
      return pastRounds.length - i;
    }
    const r = pastRounds[i];
    if (r.courts.some((c) => c.teamA.includes(userId) || c.teamB.includes(userId))) {
      everAppeared = true;
    }
  }
  if (!everAppeared) return 0; // 途中参加者: "直後にプレイ" のため低重み
  return pastRounds.length + 1; // 開始から一度も休んでいない
}

/**
 * 重み付きランダムで count 人を選ぶ（非復元抽出）。
 * weight が高い人ほど選ばれやすいが、確定ではない → グループ固定化を防ぐ。
 */
function weightedRandomPick(
  pool: { id: string; weight: number }[],
  count: number,
): string[] {
  const result: string[] = [];
  const remaining = [...pool];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * totalWeight;
    let picked = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      r -= remaining[j].weight;
      if (r <= 0) { picked = j; break; }
    }
    result.push(remaining[picked].id);
    remaining.splice(picked, 1);
  }
  return result;
}

/** 全プレーヤーを2人ずつのペアに分ける全パターンを生成（完全マッチング） */
function perfectMatchings(players: string[]): [string, string][][] {
  if (players.length === 0) return [[]];
  const [first, ...rest] = players;
  const result: [string, string][][] = [];
  for (let i = 0; i < rest.length; i++) {
    const partner = rest[i];
    const remaining = rest.filter((_, j) => j !== i);
    for (const sub of perfectMatchings(remaining)) {
      result.push([[first, partner], ...sub]);
    }
  }
  return result;
}

/** ペアのリストをコートに2ペアずつ割り当てる全パターンを生成 */
function courtGroupingsOfPairs(
  pairs: [string, string][],
  courtCount: number,
): [[string, string], [string, string]][][] {
  if (courtCount === 0) return [[]];
  const [first, ...rest] = pairs;
  const result: [[string, string], [string, string]][][] = [];
  for (let i = 0; i < rest.length; i++) {
    const second = rest[i];
    const remaining = rest.filter((_, j) => j !== i);
    for (const sub of courtGroupingsOfPairs(remaining, courtCount - 1)) {
      result.push([[first, second], ...sub]);
    }
  }
  return result;
}

const PAIR_WEIGHT = 3;
const CONSECUTIVE_PAIR_PENALTY = 50;
const CONSECUTIVE_OPPONENT_PENALTY = 20;

/** 直前ラウンドのペアキーセット */
function getPrevPairKeys(prevRound: Round | null): Set<string> {
  if (!prevRound) return new Set();
  const keys = new Set<string>();
  for (const court of prevRound.courts) {
    if (court.teamA.length === 2) keys.add([...court.teamA].sort().join(':'));
    if (court.teamB.length === 2) keys.add([...court.teamB].sort().join(':'));
  }
  return keys;
}

/** 直前ラウンドの対戦キーセット */
function getPrevOpponentKeys(prevRound: Round | null): Set<string> {
  if (!prevRound) return new Set();
  const keys = new Set<string>();
  for (const court of prevRound.courts) {
    for (const a of court.teamA) {
      for (const b of court.teamB) {
        keys.add([a, b].sort().join(':'));
      }
    }
  }
  return keys;
}

/** ペアマッチング全体のスコア（pairHistory × PAIR_WEIGHT + 連続ペアペナルティ） */
function scorePairMatching(
  matching: [string, string][],
  users: User[],
  prevPairKeys: Set<string>,
): number {
  let score = 0;
  for (const [a, b] of matching) {
    const ua = users.find((u) => u.id === a)!;
    const ub = users.find((u) => u.id === b)!;
    score += ((ua.pairHistory[b] ?? 0) + (ub.pairHistory[a] ?? 0)) * PAIR_WEIGHT;
    if (prevPairKeys.has([a, b].sort().join(':'))) score += CONSECUTIVE_PAIR_PENALTY;
  }
  return score;
}

/**
 * ペアマッチングのタイブレーカースコア
 * ペアスコアが同点のとき、潜在パートナー同士の対戦履歴が少ない組み合わせを優先する。
 * また CONSECUTIVE_OPPONENT_PENALTY により、直前ラウンドで対戦した2人をパートナーに
 * 組みにくくする効果もある（意図した設計）。
 */
function opponentTiebreakerScore(
  matching: [string, string][],
  users: User[],
  prevOpponentKeys: Set<string>,
): number {
  let score = 0;
  for (const [a, b] of matching) {
    const ua = users.find((u) => u.id === a)!;
    const ub = users.find((u) => u.id === b)!;
    score += (ua.opponentHistory[b] ?? 0) + (ub.opponentHistory[a] ?? 0);
    if (prevOpponentKeys.has([a, b].sort().join(':'))) score += CONSECUTIVE_OPPONENT_PENALTY;
  }
  return score;
}

/** コート1面分の対戦スコア（opponentHistory + 連続対戦ペナルティ） */
function scoreOpponents(
  teamA: string[],
  teamB: string[],
  users: User[],
  prevOpponentKeys: Set<string>,
): number {
  let score = 0;
  for (const a of teamA) {
    for (const b of teamB) {
      const ua = users.find((u) => u.id === a)!;
      const ub = users.find((u) => u.id === b)!;
      score += (ua.opponentHistory[b] ?? 0) + (ub.opponentHistory[a] ?? 0);
      if (prevOpponentKeys.has([a, b].sort().join(':'))) score += CONSECUTIVE_OPPONENT_PENALTY;
    }
  }
  return score;
}

/**
 * 次のラウンドを生成する
 * @param participants 現在の参加者
 * @param courtCount コート数
 * @param gameFormat シングルス or ダブルス
 * @param pastRounds 確定済みラウンドの配列（古い順）
 * @param roundIndex ラウンドインデックス
 */
export function generateRound(
  participants: User[],
  courtCount: number,
  gameFormat: GameFormat,
  pastRounds: Round[],
  roundIndex: number,
): Round {
  const playersPerCourt = gameFormat === 'doubles' ? 4 : 2;
  const totalPlaying = courtCount * playersPerCourt;
  const restCount = Math.max(0, participants.length - totalPlaying);
  const prevRound = pastRounds.length > 0 ? pastRounds[pastRounds.length - 1] : null;
  const prevPairKeys = getPrevPairKeys(prevRound);
  const prevOpponentKeys = getPrevOpponentKeys(prevRound);

  // --- Step1: 休憩者の選定 ---
  // 方針: セッション全体で休憩回数の帳尻が合えばよい（局所的な借金は許容）。
  // totalRestCount の上限（MAX_DEBT）内で、roundsSinceLastRest に基づく
  // 重み付きランダムで選出し、グループ固定化を防ぐ。
  let restingIds: string[] = [];

  if (restCount > 0) {
    const MAX_DEBT = 1;
    const minRestCount = Math.min(...participants.map((u) => u.totalRestCount));
    const lastRoundRestIds = prevRound?.restingPlayerIds ?? [];

    // 候補プール構築: 債務上限内 → 直前ラウンドで休んでない人を優先
    let eligible = participants.filter(
      (u) => u.totalRestCount <= minRestCount + MAX_DEBT && !lastRoundRestIds.includes(u.id),
    );
    // 候補不足なら直前ラウンド制約を緩和
    if (eligible.length < restCount) {
      eligible = participants.filter((u) => u.totalRestCount <= minRestCount + MAX_DEBT);
    }
    // それでも不足なら債務制約も緩和
    if (eligible.length < restCount) {
      eligible = [...participants].sort((a, b) => a.totalRestCount - b.totalRestCount);
    }

    // 重み = roundsSinceLastRest（長くプレイした人ほど休みやすい、ただし確率的）
    const pool = eligible.map((u) => ({
      id: u.id,
      weight: Math.max(1, getRoundsSinceLastRest(u.id, pastRounds)),
    }));

    restingIds = weightedRandomPick(pool, restCount);
  }

  const playing = participants.filter((u) => !restingIds.includes(u.id)).map((u) => u.id);

  // --- Step2 & 3: コート割り当て ---
  let courts: Court[];

  if (gameFormat === 'doubles') {
    // Step2: 全完全マッチングを列挙し、ペアスコアが最小のものを選ぶ
    // 同点の場合は対戦履歴をタイブレーカーとして使用（逆転なし）
    const allMatchings = perfectMatchings(playing);
    const minPairScore = Math.min(...allMatchings.map((m) => scorePairMatching(m, participants, prevPairKeys)));
    const pairTiedMatchings = allMatchings.filter((m) => scorePairMatching(m, participants, prevPairKeys) === minPairScore);
    const minTiebreaker = Math.min(...pairTiedMatchings.map((m) => opponentTiebreakerScore(m, participants, prevOpponentKeys)));
    const bestMatchings = pairTiedMatchings.filter((m) => opponentTiebreakerScore(m, participants, prevOpponentKeys) === minTiebreaker);
    const chosenMatching = bestMatchings[Math.floor(Math.random() * bestMatchings.length)];

    // Step3: ペアをコートに割り当て、対戦スコアが最小の組み合わせを選ぶ
    const allGroupings = courtGroupingsOfPairs(chosenMatching, courtCount);
    const minOpponentScore = Math.min(
      ...allGroupings.map((g) =>
        g.reduce((sum, [pA, pB]) => sum + scoreOpponents([...pA], [...pB], participants, prevOpponentKeys), 0)
      )
    );
    const bestGroupings = allGroupings.filter(
      (g) =>
        g.reduce((sum, [pA, pB]) => sum + scoreOpponents([...pA], [...pB], participants, prevOpponentKeys), 0) ===
        minOpponentScore
    );
    const chosenGrouping = bestGroupings[Math.floor(Math.random() * bestGroupings.length)];

    // コート番号はシャッフルして偏りを防ぐ
    const courtNumbers = shuffle([...Array(courtCount)].map((_, i) => i + 1));
    courts = chosenGrouping.map(([pairA, pairB], i) => ({
      courtNumber: courtNumbers[i],
      teamA: [...pairA],
      teamB: [...pairB],
    }));
    courts.sort((a, b) => a.courtNumber - b.courtNumber);
  } else {
    // シングルス: 対戦ペアの完全マッチングを全列挙してスコア最小を選ぶ
    const allMatchings = perfectMatchings(playing);
    const minScore = Math.min(
      ...allMatchings.map((m) =>
        m.reduce((sum, [a, b]) => sum + scoreOpponents([a], [b], participants, prevOpponentKeys), 0)
      )
    );
    const bestMatchings = allMatchings.filter(
      (m) =>
        m.reduce((sum, [a, b]) => sum + scoreOpponents([a], [b], participants, prevOpponentKeys), 0) === minScore
    );
    const chosenMatching = bestMatchings[Math.floor(Math.random() * bestMatchings.length)];

    const courtNumbers = shuffle([...Array(courtCount)].map((_, i) => i + 1));
    courts = chosenMatching.map(([a, b], i) => ({
      courtNumber: courtNumbers[i],
      teamA: [a],
      teamB: [b],
    }));
    courts.sort((a, b) => a.courtNumber - b.courtNumber);
  }

  return {
    index: roundIndex,
    courts,
    restingPlayerIds: restingIds,
  };
}

/**
 * 「次へ」確定後にユーザーのカウントを更新した新しいUserリストを返す
 */
export function applyRoundToUsers(round: Round, users: User[]): User[] {
  return users.map((user) => {
    const isResting = round.restingPlayerIds.includes(user.id);
    const court = round.courts.find((c) => [...c.teamA, ...c.teamB].includes(user.id));

    if (isResting) {
      return { ...user, totalRestCount: user.totalRestCount + 1 };
    }

    if (!court) return user;

    const inTeamA = court.teamA.includes(user.id);
    const myTeam = inTeamA ? court.teamA : court.teamB;
    const opponents = inTeamA ? court.teamB : court.teamA;

    const newPairHistory = { ...user.pairHistory };
    for (const partnerId of myTeam.filter((id) => id !== user.id)) {
      newPairHistory[partnerId] = (newPairHistory[partnerId] ?? 0) + 1;
    }

    const newOpponentHistory = { ...user.opponentHistory };
    for (const opponentId of opponents) {
      newOpponentHistory[opponentId] = (newOpponentHistory[opponentId] ?? 0) + 1;
    }

    return {
      ...user,
      totalPlayCount: user.totalPlayCount + 1,
      pairHistory: newPairHistory,
      opponentHistory: newOpponentHistory,
    };
  });
}

/**
 * applyRoundToUsers の逆操作 — 交代によるラウンド修正前に呼ぶ
 */
export function revertRoundFromUsers(round: Round, users: User[]): User[] {
  return users.map((user) => {
    const isResting = round.restingPlayerIds.includes(user.id);
    const court = round.courts.find((c) => [...c.teamA, ...c.teamB].includes(user.id));

    if (isResting) {
      return { ...user, totalRestCount: Math.max(0, user.totalRestCount - 1) };
    }

    if (!court) return user;

    const inTeamA = court.teamA.includes(user.id);
    const myTeam = inTeamA ? court.teamA : court.teamB;
    const opponents = inTeamA ? court.teamB : court.teamA;

    const newPairHistory = { ...user.pairHistory };
    for (const partnerId of myTeam.filter((id) => id !== user.id)) {
      const val = (newPairHistory[partnerId] ?? 0) - 1;
      if (val <= 0) delete newPairHistory[partnerId];
      else newPairHistory[partnerId] = val;
    }

    const newOpponentHistory = { ...user.opponentHistory };
    for (const opponentId of opponents) {
      const val = (newOpponentHistory[opponentId] ?? 0) - 1;
      if (val <= 0) delete newOpponentHistory[opponentId];
      else newOpponentHistory[opponentId] = val;
    }

    return {
      ...user,
      totalPlayCount: Math.max(0, user.totalPlayCount - 1),
      pairHistory: newPairHistory,
      opponentHistory: newOpponentHistory,
    };
  });
}

/**
 * 途中参加ユーザーのカウントを現参加者の平均で初期化
 */
export function initLateJoiner(user: User, participants: User[]): User {
  if (participants.length === 0) return user;
  const avgPlay = Math.round(
    participants.reduce((s, u) => s + u.totalPlayCount, 0) / participants.length
  );
  const avgRest = Math.round(
    participants.reduce((s, u) => s + u.totalRestCount, 0) / participants.length
  );
  return { ...user, totalPlayCount: avgPlay, totalRestCount: avgRest };
}
