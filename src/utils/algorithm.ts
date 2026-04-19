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

/** 配列から重複なく選ぶ組み合わせを生成 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

/** ペアのスコア（同ペア回数の合計）を計算 */
function pairScore(teamA: string[], teamB: string[], users: User[]): number {
  let score = 0;
  const getUser = (id: string) => users.find((u) => u.id === id)!;

  // チーム内ペアスコア（ダブルスのみ）
  if (teamA.length === 2) {
    score += (getUser(teamA[0]).pairHistory[teamA[1]] ?? 0);
    score += (getUser(teamA[1]).pairHistory[teamA[0]] ?? 0);
  }
  if (teamB.length === 2) {
    score += (getUser(teamB[0]).pairHistory[teamB[1]] ?? 0);
    score += (getUser(teamB[1]).pairHistory[teamB[0]] ?? 0);
  }

  // 対戦スコア
  for (const a of teamA) {
    for (const b of teamB) {
      score += (getUser(a).opponentHistory[b] ?? 0);
      score += (getUser(b).opponentHistory[a] ?? 0);
    }
  }

  return score;
}

/** コート内4人を最適な2vs2に分割 */
function bestSplit(players: string[], users: User[]): { teamA: string[]; teamB: string[] } {
  const splits = combinations(players, 2).map((teamA) => {
    const teamB = players.filter((p) => !teamA.includes(p));
    return { teamA, teamB, score: pairScore(teamA, teamB, users) };
  });

  const minScore = Math.min(...splits.map((s) => s.score));
  const best = splits.filter((s) => s.score === minScore);
  const chosen = best[Math.floor(Math.random() * best.length)];
  return { teamA: chosen.teamA, teamB: chosen.teamB };
}

/**
 * 次のラウンドを生成する
 * @param participants 現在の参加者
 * @param courtCount コート数
 * @param gameFormat シングルス or ダブルス
 * @param prevRestingIds 直前ラウンドで休憩した人のID
 */
export function generateRound(
  participants: User[],
  courtCount: number,
  gameFormat: GameFormat,
  prevRestingIds: string[],
  roundIndex: number,
): Round {
  const playersPerCourt = gameFormat === 'doubles' ? 4 : 2;
  const totalPlaying = courtCount * playersPerCourt;
  const restCount = Math.max(0, participants.length - totalPlaying);

  // --- Step1: 休憩者の選定 ---
  let restingPlayers: User[] = [];

  if (restCount > 0) {
    // 休憩回数でソート（少ない順）、同回数なら直前休憩者を後回し
    const sorted = [...participants].sort((a, b) => {
      if (a.totalRestCount !== b.totalRestCount) return a.totalRestCount - b.totalRestCount;
      const aRested = prevRestingIds.includes(a.id) ? 1 : 0;
      const bRested = prevRestingIds.includes(b.id) ? 1 : 0;
      return aRested - bRested; // 直前休憩者を後ろに
    });

    // 同条件グループ内はランダム
    const minRest = sorted[0].totalRestCount;
    const minGroup = sorted.filter(
      (u) => u.totalRestCount === minRest && !prevRestingIds.includes(u.id)
    );
    const fallback = sorted.filter((u) => u.totalRestCount === minRest && prevRestingIds.includes(u.id));
    const candidates = minGroup.length > 0 ? minGroup : fallback;

    restingPlayers = shuffle(candidates).slice(0, restCount);

    // 必要数に満たない場合（同回数グループが小さい場合）残りを補充
    if (restingPlayers.length < restCount) {
      const remaining = sorted
        .filter((u) => !restingPlayers.includes(u))
        .slice(0, restCount - restingPlayers.length);
      restingPlayers = [...restingPlayers, ...remaining];
    }
  }

  const restingIds = restingPlayers.map((u) => u.id);
  const playing = participants.filter((u) => !restingIds.includes(u.id));

  // --- Step2 & 3: コート割り当て & ペア決め ---
  // コートへの割り当てはシャッフルベースでスコア最小を選ぶ
  const TRIALS = 20;
  let bestCourts: Court[] | null = null;
  let bestScore = Infinity;

  for (let t = 0; t < TRIALS; t++) {
    const shuffled = shuffle(playing);
    const courts: Court[] = [];
    let trialScore = 0;

    for (let i = 0; i < courtCount; i++) {
      const group = shuffled.slice(i * playersPerCourt, (i + 1) * playersPerCourt);
      const ids = group.map((u) => u.id);

      if (gameFormat === 'doubles') {
        const { teamA, teamB } = bestSplit(ids, participants);
        const score = pairScore(teamA, teamB, participants);
        trialScore += score;
        courts.push({ courtNumber: i + 1, teamA, teamB });
      } else {
        // シングルス
        const score =
          (participants.find((u) => u.id === ids[0])?.opponentHistory[ids[1]] ?? 0) +
          (participants.find((u) => u.id === ids[1])?.opponentHistory[ids[0]] ?? 0);
        trialScore += score;
        courts.push({ courtNumber: i + 1, teamA: [ids[0]], teamB: [ids[1]] });
      }
    }

    if (trialScore < bestScore) {
      bestScore = trialScore;
      bestCourts = courts;
    }
  }

  return {
    index: roundIndex,
    courts: bestCourts!,
    restingPlayerIds: restingIds,
  };
}

/**
 * 「次へ」確定後にユーザーのカウントを更新した新しいUserリストを返す
 */
export function applyRoundToUsers(round: Round, users: User[]): User[] {
  return users.map((user) => {
    const isResting = round.restingPlayerIds.includes(user.id);
    const court = round.courts.find(
      (c) => [...c.teamA, ...c.teamB].includes(user.id)
    );

    if (isResting) {
      return { ...user, totalRestCount: user.totalRestCount + 1 };
    }

    if (!court) return user;

    const inTeamA = court.teamA.includes(user.id);
    const myTeam = inTeamA ? court.teamA : court.teamB;
    const opponents = inTeamA ? court.teamB : court.teamA;

    // ペア履歴を更新
    const newPairHistory = { ...user.pairHistory };
    for (const partnerId of myTeam.filter((id) => id !== user.id)) {
      newPairHistory[partnerId] = (newPairHistory[partnerId] ?? 0) + 1;
    }

    // 対戦履歴を更新
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
