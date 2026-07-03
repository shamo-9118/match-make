import { User, PairType, TeamBattleMatch } from '../types';

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
 * ペア構成パターンのサジェスト
 * チームの男女人数とペア数・シングルス枠から、実現可能な構成パターンを列挙する。
 * 両チームで同じ構成になる必要があるため、男女数が少ない方に合わせて生成する。
 */
export function suggestPairCompositions(
  malesA: number,
  femalesA: number,
  malesB: number,
  femalesB: number,
  totalPairs: number,
  singlesPairs: number,
): PairType[][] {
  const doublesPairs = totalPairs - singlesPairs;
  const females = Math.min(femalesA, femalesB);
  const results: PairType[][] = [];

  // シングルス枠の構成（男子・女子・ミックスを含め、ここでは型だけ 'singles' で統一）
  // ダブルス枠の構成を列挙: womens を 0〜females/2 枠、mixed を 0〜females 枠
  for (let womens = 0; womens <= Math.floor(females / 2); womens++) {
    for (let mixed = 0; mixed <= females - womens * 2; mixed++) {
      const mens = doublesPairs - womens - mixed;
      if (mens < 0) continue;
      // 男子人数チェック（両チームで成立するか）
      const malesNeededA = mens * 2 + mixed;
      const malesNeededB = mens * 2 + mixed;
      if (malesNeededA > malesA || malesNeededB > malesB) continue;
      const femalesNeededA = womens * 2 + mixed;
      const femalesNeededB = womens * 2 + mixed;
      if (femalesNeededA > femalesA || femalesNeededB > femalesB) continue;

      const composition: PairType[] = [
        ...Array(mens).fill('mens' as PairType),
        ...Array(womens).fill('womens' as PairType),
        ...Array(mixed).fill('mixed' as PairType),
        ...Array(singlesPairs).fill('singles' as PairType),
      ];
      results.push(composition);
    }
  }

  return results;
}

/**
 * チームのメンバーをペア構成に従ってランダムにペアリングする。
 * teamBattlePairHistory を参照し、過去に組んだ回数が少ない組み合わせを優先する。
 */
function formPairs(
  memberIds: string[],
  users: User[],
  composition: PairType[],
): { playerIds: string[]; pairType: PairType }[] {
  const members = shuffle(memberIds);
  const pairs: { playerIds: string[]; pairType: PairType }[] = [];

  // 性別ごとに分類
  const males = members.filter((id) => users.find((u) => u.id === id)?.gender === 'male');
  const females = members.filter((id) => users.find((u) => u.id === id)?.gender === 'female');
  const others = members.filter((id) => {
    const g = users.find((u) => u.id === id)?.gender;
    return g !== 'male' && g !== 'female';
  });

  // 性別未設定者は males に回す
  const malePool = [...males, ...others];
  const femalePool = [...females];

  /** ペアスコアが最小になる組み合わせをプールから選ぶ */
  const pickBestPair = (pool: string[]): [string, string] => {
    let best: [string, string] = [pool[0], pool[1]];
    let bestScore = Infinity;
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i], b = pool[j];
        const ua = users.find((u) => u.id === a);
        const ub = users.find((u) => u.id === b);
        const score = (ua?.teamBattlePairHistory[b] ?? 0) + (ub?.teamBattlePairHistory[a] ?? 0);
        if (score < bestScore) { bestScore = score; best = [a, b]; }
      }
    }
    return best;
  };

  const pickBestMixed = (mPool: string[], fPool: string[]): [string, string] => {
    let best: [string, string] = [mPool[0], fPool[0]];
    let bestScore = Infinity;
    for (const m of mPool) {
      for (const f of fPool) {
        const um = users.find((u) => u.id === m);
        const uf = users.find((u) => u.id === f);
        const score = (um?.teamBattlePairHistory[f] ?? 0) + (uf?.teamBattlePairHistory[m] ?? 0);
        if (score < bestScore) { bestScore = score; best = [m, f]; }
      }
    }
    return best;
  };

  const removeFrom = (pool: string[], ids: string[]) => {
    for (const id of ids) {
      const i = pool.indexOf(id);
      if (i !== -1) pool.splice(i, 1);
    }
  };

  for (const pairType of composition) {
    if (pairType === 'mens') {
      const [a, b] = pickBestPair(malePool);
      pairs.push({ playerIds: [a, b], pairType });
      removeFrom(malePool, [a, b]);
    } else if (pairType === 'womens') {
      const [a, b] = pickBestPair(femalePool);
      pairs.push({ playerIds: [a, b], pairType });
      removeFrom(femalePool, [a, b]);
    } else if (pairType === 'mixed') {
      const [m, f] = pickBestMixed(malePool, femalePool);
      pairs.push({ playerIds: [m, f], pairType });
      removeFrom(malePool, [m]);
      removeFrom(femalePool, [f]);
    } else {
      // singles: 対戦相手が少ない人を優先（ここではランダム）
      const player = malePool.length > 0 ? malePool.shift()! : femalePool.shift()!;
      pairs.push({ playerIds: [player], pairType });
    }
  }

  return pairs;
}

/**
 * 団体戦の全試合を一括生成する。
 * - ペア構成に従い両チームのペアを決定
 * - 同じ pairType 同士で対戦カードを組む
 * - 試合順・コート割り当てをランダムに決定
 */
export function generateTeamBattleMatches(
  teamAId: string,
  teamAMemberIds: string[],
  teamBId: string,
  teamBMemberIds: string[],
  users: User[],
  composition: PairType[],
  courtCount: number,
): TeamBattleMatch[] {
  const pairsA = formPairs(teamAMemberIds, users, composition);
  const pairsB = formPairs(teamBMemberIds, users, composition);

  // 同じインデックスのペア同士で対戦カードを組む。
  // pairTypeA と pairTypeB は異なっていても許容する（運用上ペアタイプが一致しない対戦が発生するため）。
  const count = Math.min(pairsA.length, pairsB.length);
  const matchCards = Array.from({ length: count }, (_, i) => ({
    pairTypeA: pairsA[i].pairType,
    pairTypeB: pairsB[i].pairType,
    pairA: pairsA[i].playerIds,
    pairB: pairsB[i].playerIds,
  }));

  // 試合順をシャッフル
  const shuffledCards = shuffle(matchCards);

  // コートに順番に割り当て（コート1,2,...,courtCount, 1,2,...の繰り返し）
  return shuffledCards.map((card, i) => ({
    matchNumber: i + 1,
    courtNumber: (i % courtCount) + 1,
    pairTypeA: card.pairTypeA,
    pairTypeB: card.pairTypeB,
    pairA: { playerIds: card.pairA, teamId: teamAId },
    pairB: { playerIds: card.pairB, teamId: teamBId },
  }));
}

/**
 * 試合結果を teamBattlePairHistory・teamBattleOpponentHistory に反映した新しい User リストを返す。
 */
export function applyTeamBattleMatchToUsers(match: TeamBattleMatch, users: User[]): User[] {
  const allPairs = [match.pairA, match.pairB];

  return users.map((user) => {
    const myPair = allPairs.find((p) => p.playerIds.includes(user.id));
    if (!myPair) return user;

    const opponentPair = allPairs.find((p) => p !== myPair)!;

    const newPairHistory = { ...user.teamBattlePairHistory };
    for (const partnerId of myPair.playerIds.filter((id) => id !== user.id)) {
      newPairHistory[partnerId] = (newPairHistory[partnerId] ?? 0) + 1;
    }

    const newOpponentHistory = { ...user.teamBattleOpponentHistory };
    for (const opponentId of opponentPair.playerIds) {
      newOpponentHistory[opponentId] = (newOpponentHistory[opponentId] ?? 0) + 1;
    }

    return { ...user, teamBattlePairHistory: newPairHistory, teamBattleOpponentHistory: newOpponentHistory };
  });
}
