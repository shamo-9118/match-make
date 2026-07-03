'use client';
import { useState } from 'react';
import {
  AppShell, Button, Group, Stack, Text, Card, Flex, Badge,
  Avatar, Modal, Title, SimpleGrid, Paper,
} from '@mantine/core';

const COURT_GREEN = '#2d7a3a';
import { useRouter } from 'next/navigation';
import { useTeamBattleSessionStore } from '@/store/teamBattleSessionStore';
import { useUserStore } from '@/store/userStore';
import { applyTeamBattleMatchToUsers } from '@/utils/teamBattleAlgorithm';
import { TeamBattleMatch } from '@/types';

export default function TeamSessionPage() {
  const router = useRouter();
  const { session, recordResult, endSession } = useTeamBattleSessionStore();
  const { users, updateUserStats } = useUserStore();
  const [endOpened, setEndOpened] = useState(false);
  const [resultOpened, setResultOpened] = useState(false);

  if (!session) {
    return (
      <Flex h="100vh" align="center" justify="center" direction="column" gap="md">
        <Text>セッションがありません</Text>
        <Button onClick={() => router.push('/setup/team')}>団体戦設定へ</Button>
      </Flex>
    );
  }

  const { teamA, teamB, matches, courtCount } = session;

  // コートごとに試合リストを分ける
  const matchesByCourt: Record<number, TeamBattleMatch[]> = {};
  for (let c = 1; c <= courtCount; c++) {
    matchesByCourt[c] = matches.filter((m) => m.courtNumber === c).sort((a, b) => a.matchNumber - b.matchNumber);
  }

  // 各コートの現在の試合（winnerTeamId が undefined の最初の試合）
  const currentMatchByCourt: Record<number, TeamBattleMatch | null> = {};
  for (let c = 1; c <= courtCount; c++) {
    currentMatchByCourt[c] = matchesByCourt[c].find((m) => m.winnerTeamId === undefined) ?? null;
  }

  const winsA = matches.filter((m) => m.winnerTeamId === teamA.id).length;
  const winsB = matches.filter((m) => m.winnerTeamId === teamB.id).length;
  const totalFinished = matches.filter((m) => m.winnerTeamId !== undefined).length;
  const allDone = totalFinished === matches.length;

  const handleRecordResult = (matchNumber: number, winnerTeamId: string) => {
    // 統計を更新
    const match = matches.find((m) => m.matchNumber === matchNumber);
    if (match) {
      const updated = applyTeamBattleMatchToUsers(match, users);
      updateUserStats(updated);
    }
    recordResult(matchNumber, winnerTeamId);
    if (allAfterRecord(matchNumber)) setResultOpened(true);
  };

  // この記録後に全試合終了するか
  const allAfterRecord = (matchNumber: number) => {
    return matches.every((m) => m.matchNumber === matchNumber || m.winnerTeamId !== undefined);
  };

  const handleAdvance = (courtNumber: number) => {
    const current = currentMatchByCourt[courtNumber];
    if (!current) return;
    if (current.winnerTeamId === undefined) {
      if (!window.confirm('結果が未入力です。このまま次の試合へ進みますか？')) return;
      recordResult(current.matchNumber, null); // null = 結果なしスキップ（undefined は未試合を意味するため区別）
    }
  };

  const getUser = (id: string) => users.find((u) => u.id === id);

  // 個人戦の CourtCard と同スタイル（デスクトップ用）
  const PlayerChip = ({ id }: { id: string }) => {
    const u = getUser(id);
    return (
      <Stack align="center" gap={8}>
        <Avatar src={u?.imagePath} size={80} radius="xl" color={u?.color ?? 'gray'}>{u?.name[0] ?? '?'}</Avatar>
        <Text size="lg" fw={700} c="white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{u?.name ?? id}</Text>
      </Stack>
    );
  };

  // モバイル用コンパクト表示
  const PlayerMobile = ({ id }: { id: string }) => {
    const u = getUser(id);
    return (
      <Flex align="center" gap="xs" style={{ overflow: 'hidden' }}>
        <Avatar src={u?.imagePath} size={40} radius="xl" color={u?.color ?? 'gray'} style={{ flexShrink: 0 }}>{u?.name[0] ?? '?'}</Avatar>
        <Text size="md" fw={700} c="white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u?.name ?? id}</Text>
      </Flex>
    );
  };

  const pairTypeLabel = (type: string) =>
    ({ mens: '男子', womens: '女子', mixed: 'ミックス', singles: 'シングルス' }[type] ?? type);

  const resultLabel = allDone
    ? winsA > winsB ? `${teamA.name} 勝利！` : winsA < winsB ? `${teamB.name} 勝利！` : '引き分け'
    : null;

  const resultColor = allDone
    ? winsA !== winsB ? 'green' : 'gray'
    : 'gray';

  return (
    <AppShell header={{ height: 60 }} footer={{ height: 70 }} padding="md">
      <AppShell.Header>
        <Flex h="100%" px="md" align="center" justify="space-between">
          <Button color="red" variant="light" size="sm" onClick={() => setEndOpened(true)}>← 終了</Button>

          {/* リアルタイムスコア */}
          <Group gap="xs">
            <Flex align="center" gap={6}>
              <Avatar src={teamA.logoPath} size={28} radius="md">{teamA.name[0]}</Avatar>
              <Text fw={700} size="lg" c="blue">{winsA}</Text>
            </Flex>
            <Text fw={700} c="dimmed">-</Text>
            <Flex align="center" gap={6}>
              <Text fw={700} size="lg" c="orange">{winsB}</Text>
              <Avatar src={teamB.logoPath} size={28} radius="md">{teamB.name[0]}</Avatar>
            </Flex>
          </Group>

          <Text size="sm" c="dimmed">{totalFinished}/{matches.length}試合</Text>
        </Flex>
      </AppShell.Header>

      <AppShell.Main>
        <SimpleGrid cols={{ base: 1, md: courtCount > 1 ? 2 : 1 }} spacing="lg">
          {Array.from({ length: courtCount }, (_, i) => i + 1).map((courtNum) => {
            const current = currentMatchByCourt[courtNum];
            const done = !current;
            const remaining = matchesByCourt[courtNum].filter((m) => m.winnerTeamId === undefined).length;

            return (
              <Card key={courtNum} radius="md" padding={0} style={{ overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                {/* ヘッダー（個人戦と同色） */}
                <Flex bg="#1a5c28" px="md" py="xs" align="center" justify="space-between">
                  <Text c="white" fw={700}>コート {courtNum}</Text>
                  {!done && current && (
                    <Group gap="xs">
                      <Badge variant="light" color="gray" size="sm">{pairTypeLabel(current.pairType)}</Badge>
                      <Badge variant="light" color="gray" size="sm">残り {remaining}</Badge>
                    </Group>
                  )}
                </Flex>

                {done ? (
                  <Flex align="center" justify="center" h={160} bg="gray.0">
                    <Text c="dimmed">全試合終了</Text>
                  </Flex>
                ) : (
                  <>
                    {/* モバイル: 縦レイアウト */}
                    <Stack bg={COURT_GREEN} px="md" py="sm" gap="xs" hiddenFrom="sm">
                      <Flex align="center" gap={6}>
                        <Avatar src={teamA.logoPath} size={18} radius="sm">{teamA.name[0]}</Avatar>
                        <Text size="xs" c="rgba(255,255,255,0.75)" fw={600}>{teamA.name}</Text>
                      </Flex>
                      <SimpleGrid cols={current.pairA.playerIds.length} spacing="xs">
                        {current.pairA.playerIds.map((id) => <PlayerMobile key={id} id={id} />)}
                      </SimpleGrid>
                      <Flex align="center" gap="sm" my={2}>
                        <Paper flex={1} h={2} bg="rgba(255,255,255,0.4)" radius="sm" />
                        <Text c="white" fw={900} size="sm">VS</Text>
                        <Paper flex={1} h={2} bg="rgba(255,255,255,0.4)" radius="sm" />
                      </Flex>
                      <SimpleGrid cols={current.pairB.playerIds.length} spacing="xs">
                        {current.pairB.playerIds.map((id) => <PlayerMobile key={id} id={id} />)}
                      </SimpleGrid>
                      <Flex align="center" gap={6} justify="flex-end">
                        <Text size="xs" c="rgba(255,255,255,0.75)" fw={600}>{teamB.name}</Text>
                        <Avatar src={teamB.logoPath} size={18} radius="sm">{teamB.name[0]}</Avatar>
                      </Flex>
                    </Stack>

                    {/* デスクトップ: 横レイアウト */}
                    <Flex bg={COURT_GREEN} p="xl" align="center" justify="space-around" style={{ minHeight: 180 }} visibleFrom="sm">
                      <Stack align="center" flex={1} gap="sm">
                        <Flex align="center" gap={6}>
                          <Avatar src={teamA.logoPath} size={20} radius="sm">{teamA.name[0]}</Avatar>
                          <Text size="xs" c="rgba(255,255,255,0.75)" fw={600}>{teamA.name}</Text>
                        </Flex>
                        <Group gap="xl" justify="center">
                          {current.pairA.playerIds.map((id) => <PlayerChip key={id} id={id} />)}
                        </Group>
                      </Stack>

                      <Stack align="center" gap={4} mx="md">
                        <Paper w={4} h={40} bg="rgba(255,255,255,0.7)" radius="sm" />
                        <Text c="white" fw={900} size="lg">VS</Text>
                        <Paper w={4} h={40} bg="rgba(255,255,255,0.7)" radius="sm" />
                      </Stack>

                      <Stack align="center" flex={1} gap="sm">
                        <Group gap="xl" justify="center">
                          {current.pairB.playerIds.map((id) => <PlayerChip key={id} id={id} />)}
                        </Group>
                        <Flex align="center" gap={6}>
                          <Text size="xs" c="rgba(255,255,255,0.75)" fw={600}>{teamB.name}</Text>
                          <Avatar src={teamB.logoPath} size={20} radius="sm">{teamB.name[0]}</Avatar>
                        </Flex>
                      </Stack>
                    </Flex>

                    {/* 結果入力 */}
                    <Stack gap="xs" p="md">
                      <Group grow>
                        <Button color="blue" variant="light" onClick={() => handleRecordResult(current.matchNumber, teamA.id)}>
                          {teamA.name} 勝ち
                        </Button>
                        <Button color="orange" variant="light" onClick={() => handleRecordResult(current.matchNumber, teamB.id)}>
                          {teamB.name} 勝ち
                        </Button>
                      </Group>
                      <Button variant="subtle" color="gray" size="xs" onClick={() => handleAdvance(courtNum)}>
                        結果なしで次へ
                      </Button>
                    </Stack>
                  </>
                )}
              </Card>
            );
          })}
        </SimpleGrid>
      </AppShell.Main>

      <AppShell.Footer>
        <Flex h="100%" px="md" align="center" justify="center">
          {allDone ? (
            <Button size="md" fullWidth color="green" onClick={() => setResultOpened(true)}>
              結果を見る →
            </Button>
          ) : (
            <Text c="dimmed" size="sm">各コートで試合結果を入力してください</Text>
          )}
        </Flex>
      </AppShell.Footer>

      {/* 結果モーダル */}
      <Modal opened={resultOpened} onClose={() => setResultOpened(false)} centered size="sm" withCloseButton={false}>
        <Stack align="center" gap="lg" py="md">
          <Title order={2} c={resultColor}>{resultLabel}</Title>
          <SimpleGrid cols={2} w="100%">
            <Stack align="center" gap={4}>
              <Avatar src={teamA.logoPath} size={64} radius="md">{teamA.name[0]}</Avatar>
              <Text fw={700}>{teamA.name}</Text>
              <Text size="xl" fw={900} c="blue">{winsA} 勝</Text>
            </Stack>
            <Stack align="center" gap={4}>
              <Avatar src={teamB.logoPath} size={64} radius="md">{teamB.name[0]}</Avatar>
              <Text fw={700}>{teamB.name}</Text>
              <Text size="xl" fw={900} c="orange">{winsB} 勝</Text>
            </Stack>
          </SimpleGrid>
          <Button fullWidth color="gray" variant="light" onClick={() => { endSession(); router.push('/'); }}>
            トップへ戻る
          </Button>
        </Stack>
      </Modal>

      {/* 終了確認 */}
      <Modal opened={endOpened} onClose={() => setEndOpened(false)} title="団体戦を終了" centered>
        <Text>団体戦を終了しますか？統計は保存されます。</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={() => setEndOpened(false)}>キャンセル</Button>
          <Button color="red" onClick={() => { endSession(); router.push('/'); }}>終了</Button>
        </Group>
      </Modal>
    </AppShell>
  );
}
