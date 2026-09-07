import { User, Court, Round, GameFormat } from '../types';

// =====================================================================
// 定数
// =====================================================================

/** プレイ人数がこの値以下なら全列挙で最適解を求める */
const EXHAUSTIVE_THRESHOLD = 10;

const PAIR_WEIGHT = 3;
const CONSECUTIVE_PAIR_PENALTY = 50;
const CONSECUTIVE_OPPONENT_PENALTY = 20;

/** Multi-start hill climbing の初期解生成数 */
const MULTI_START_COUNT = 80;

/**
 * 連続休憩の重みダンプニング係数。
 * 直前ラウンドで休憩した人の休憩選出重みをこの係数で減衰させる。
 * 完全除外（旧仕様）ではなく確率的に許容することで、
 * プレイ人数≒休憩人数の場面（例: 8人1コート）でのグループ固定化を防ぐ。
 * 0.2 の場合、8人1コートで約70%の確率で1人が持ち越し休憩となり
 * 毎ラウンド異なるメンバー構成が生まれる。
 */
const CONSECUTIVE_REST_DAMPENING = 0.2;

// =====================================================================
// 汎用ユーティリティ
// =====================================================================

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

// =====================================================================
// 組み合わせ列挙（少人数用）
// =====================================================================

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

// =====================================================================
// ランダムマッチング生成
// =====================================================================

/** プレイヤーをシャッフルして隣接ペアにする（ランダムな完全マッチング1つ） */
function randomMatching(players: string[]): [string, string][] {
  const shuffled = shuffle(players);
  const pairs: [string, string][] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  return pairs;
}

// =====================================================================
// スコアリング関数（少人数全列挙パス用 — find() ベース）
// =====================================================================

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

// =====================================================================
// Map ベーススコアリング（大人数 hill climbing パス用 — O(1) ルックアップ）
// =====================================================================

function scorePairMatchingFast(
  matching: [string, string][],
  userMap: Map<string, User>,
  prevPairKeys: Set<string>,
): number {
  let score = 0;
  for (const [a, b] of matching) {
    const ua = userMap.get(a)!;
    const ub = userMap.get(b)!;
    score += ((ua.pairHistory[b] ?? 0) + (ub.pairHistory[a] ?? 0)) * PAIR_WEIGHT;
    if (prevPairKeys.has([a, b].sort().join(':'))) score += CONSECUTIVE_PAIR_PENALTY;
  }
  return score;
}

function opponentTiebreakerScoreFast(
  matching: [string, string][],
  userMap: Map<string, User>,
  prevOpponentKeys: Set<string>,
): number {
  let score = 0;
  for (const [a, b] of matching) {
    const ua = userMap.get(a)!;
    const ub = userMap.get(b)!;
    score += (ua.opponentHistory[b] ?? 0) + (ub.opponentHistory[a] ?? 0);
    if (prevOpponentKeys.has([a, b].sort().join(':'))) score += CONSECUTIVE_OPPONENT_PENALTY;
  }
  return score;
}

function scoreOpponentsFast(
  teamA: string[],
  teamB: string[],
  userMap: Map<string, User>,
  prevOpponentKeys: Set<string>,
): number {
  let score = 0;
  for (const a of teamA) {
    for (const b of teamB) {
      const ua = userMap.get(a)!;
      const ub = userMap.get(b)!;
      score += (ua.opponentHistory[b] ?? 0) + (ub.opponentHistory[a] ?? 0);
      if (prevOpponentKeys.has([a, b].sort().join(':'))) score += CONSECUTIVE_OPPONENT_PENALTY;
    }
  }
  return score;
}

// =====================================================================
// Multi-start hill climbing（大人数向け探索）
// =====================================================================

/**
 * 2ペアのパートナーを交換した近傍を列挙する。
 * 8ペアなら C(8,2)×2 = 56 通りの近傍 — 非常に軽量。
 */
function* pairSwapNeighbors(
  matching: [string, string][],
): Generator<[string, string][]> {
  for (let i = 0; i < matching.length; i++) {
    for (let j = i + 1; j < matching.length; j++) {
      const [a, b] = matching[i];
      const [c, d] = matching[j];
      // 交換パターン1: (a,c) + (b,d)
      const m1 = [...matching] as [string, string][];
      m1[i] = [a, c];
      m1[j] = [b, d];
      yield m1;
      // 交換パターン2: (a,d) + (b,c)
      const m2 = [...matching] as [string, string][];
      m2[i] = [a, d];
      m2[j] = [b, c];
      yield m2;
    }
  }
}

/**
 * 局所探索: スコア関数が [primary, secondary] のタプルを返し、
 * 辞書順で改善がなくなるまでペアスワップを繰り返す（first-improvement pivot）。
 */
function hillClimbMatching(
  initial: [string, string][],
  scoreFn: (m: [string, string][]) => [number, number],
): [string, string][] {
  let current = initial;
  let [curP, curS] = scoreFn(current);

  let improved = true;
  while (improved) {
    improved = false;
    for (const neighbor of pairSwapNeighbors(current)) {
      const [p, s] = scoreFn(neighbor);
      if (p < curP || (p === curP && s < curS)) {
        current = neighbor;
        curP = p;
        curS = s;
        improved = true;
        break; // first-improvement: 見つけ次第次のイテレーションへ
      }
    }
  }
  return current;
}

/**
 * Multi-start hill climbing: 複数のランダム初期解から各々局所探索し、
 * 全体の最良解を返す。純粋ランダムサンプリングと比べ、
 * 探索空間が大きい場合（16人以上）でも良質な解に到達しやすい。
 */
function multiStartHillClimb(
  playing: string[],
  scoreFn: (m: [string, string][]) => [number, number],
): [string, string][] {
  let best: [string, string][] | null = null;
  let bestP = Infinity;
  let bestS = Infinity;

  for (let i = 0; i < MULTI_START_COUNT; i++) {
    const initial = randomMatching(playing);
    const optimized = hillClimbMatching(initial, scoreFn);
    const [p, s] = scoreFn(optimized);
    if (!best || p < bestP || (p === bestP && s < bestS)) {
      best = optimized;
      bestP = p;
      bestS = s;
    }
  }
  return best!;
}

// =====================================================================
// ラウンド生成
// =====================================================================

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
  // 重み付きランダムで選出。直前ラウンドの休憩者はハード除外せず
  // CONSECUTIVE_REST_DAMPENING で重みを減衰させることで、
  // グループ固定化（8人1コートで4:4が交互に固定される問題）を防ぐ。
  let restingIds: string[] = [];

  if (restCount > 0) {
    const MAX_DEBT = 1;
    const minRestCount = Math.min(...participants.map((u) => u.totalRestCount));
    const lastRoundRestIds = prevRound?.restingPlayerIds ?? [];

    // 債務制限内の候補を抽出
    let eligible = participants.filter(
      (u) => u.totalRestCount <= minRestCount + MAX_DEBT,
    );
    // 候補不足なら債務制約を緩和（restCount 昇順でソート）
    if (eligible.length < restCount) {
      eligible = [...participants].sort((a, b) => a.totalRestCount - b.totalRestCount);
    }

    // 重み付きプール: roundsSinceLastRest ベース + 連続休憩ダンプニング
    const pool = eligible.map((u) => {
      const base = Math.max(1, getRoundsSinceLastRest(u.id, pastRounds));
      const weight = lastRoundRestIds.includes(u.id)
        ? base * CONSECUTIVE_REST_DAMPENING
        : base;
      return { id: u.id, weight };
    });

    restingIds = weightedRandomPick(pool, restCount);
  }

  const playing = participants.filter((u) => !restingIds.includes(u.id)).map((u) => u.id);

  // --- Step2 & 3: コート割り当て ---
  let courts: Court[];

  if (gameFormat === 'doubles') {
    let chosenGrouping: [[string, string], [string, string]][];

    if (playing.length <= EXHAUSTIVE_THRESHOLD) {
      // ---- 少人数: 全列挙で最適解 ----
      const allMatchings = perfectMatchings(playing);
      const minPairScore = Math.min(...allMatchings.map((m) => scorePairMatching(m, participants, prevPairKeys)));
      const pairTiedMatchings = allMatchings.filter((m) => scorePairMatching(m, participants, prevPairKeys) === minPairScore);
      const minTiebreaker = Math.min(...pairTiedMatchings.map((m) => opponentTiebreakerScore(m, participants, prevOpponentKeys)));
      const bestMatchings = pairTiedMatchings.filter((m) => opponentTiebreakerScore(m, participants, prevOpponentKeys) === minTiebreaker);
      const chosenMatching = bestMatchings[Math.floor(Math.random() * bestMatchings.length)];

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
      chosenGrouping = bestGroupings[Math.floor(Math.random() * bestGroupings.length)];
    } else {
      // ---- 大人数: Multi-start hill climbing + コートグルーピング全列挙 ----
      const userMap = new Map(participants.map((u) => [u.id, u]));

      // ペアマッチング: hill climbing で近似最適解
      const doublesScoreFn = (m: [string, string][]): [number, number] => [
        scorePairMatchingFast(m, userMap, prevPairKeys),
        opponentTiebreakerScoreFast(m, userMap, prevOpponentKeys),
      ];
      const chosenMatching = multiStartHillClimb(playing, doublesScoreFn);

      // コートグルーピング: ペア数 = courtCount×2 なので全列挙で十分
      // (4コート→8ペア→105通り、5コート→10ペア→945通り)
      const allGroupings = courtGroupingsOfPairs(chosenMatching, courtCount);
      const minOpponentScore = Math.min(
        ...allGroupings.map((g) =>
          g.reduce((sum, [pA, pB]) => sum + scoreOpponentsFast([...pA], [...pB], userMap, prevOpponentKeys), 0)
        )
      );
      const bestGroupings = allGroupings.filter(
        (g) =>
          g.reduce((sum, [pA, pB]) => sum + scoreOpponentsFast([...pA], [...pB], userMap, prevOpponentKeys), 0) ===
          minOpponentScore
      );
      chosenGrouping = bestGroupings[Math.floor(Math.random() * bestGroupings.length)];
    }

    const courtNumbers = shuffle([...Array(courtCount)].map((_, i) => i + 1));
    courts = chosenGrouping.map(([pairA, pairB], i) => ({
      courtNumber: courtNumbers[i],
      teamA: [...pairA],
      teamB: [...pairB],
    }));
    courts.sort((a, b) => a.courtNumber - b.courtNumber);
  } else {
    // ---- シングルス ----
    let chosenMatching: [string, string][];

    if (playing.length <= EXHAUSTIVE_THRESHOLD) {
      // 少人数: 全列挙
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
      chosenMatching = bestMatchings[Math.floor(Math.random() * bestMatchings.length)];
    } else {
      // 大人数: Multi-start hill climbing
      const userMap = new Map(participants.map((u) => [u.id, u]));
      const singlesScoreFn = (m: [string, string][]): [number, number] => [
        m.reduce((sum, [a, b]) => sum + scoreOpponentsFast([a], [b], userMap, prevOpponentKeys), 0),
        0,
      ];
      chosenMatching = multiStartHillClimb(playing, singlesScoreFn);
    }

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

// =====================================================================
// カウント更新・巻き戻し・途中参加
// =====================================================================

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
