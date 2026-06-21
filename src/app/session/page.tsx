'use client';
import { useState } from 'react';
import {
  AppShell, Button, Group, Stack, Avatar, Text, Card,
  Flex, Badge, Modal, SimpleGrid, Paper,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/store/sessionStore';
import { useUserStore } from '@/store/userStore';
import { generateRound, applyRoundToUsers, initLateJoiner } from '@/utils/algorithm';
import { Court, Round, User } from '@/types';

export default function SessionPage() {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const { confirmNextRound, setNextRound, goBack, goToLatest, updateParticipants, endSession } = useSessionStore();
  const { users, updateUserStats } = useUserStore();
  const [participantsOpened, { open: openParticipants, close: closeParticipants }] = useDisclosure(false);
  const [endOpened, { open: openEnd, close: closeEnd }] = useDisclosure(false);

  const isViewing = session ? session.currentRoundIndex < session.latestRoundIndex : false;
  const currentRound: Round | null = session ? session.rounds[session.currentRoundIndex] ?? null : null;

  const scheduleNextRound = (afterRound: Round, updatedUsers: User[], participantIds: string[]) => {
    const participants = updatedUsers.filter((u) => participantIds.includes(u.id));
    setTimeout(() => {
      const next = generateRound(participants, session!.courtCount, session!.gameFormat, afterRound.restingPlayerIds, afterRound.index + 1);
      setNextRound(next);
    }, 0);
  };

  const handleNext = () => {
    if (!session) return;
    if (isViewing) { goToLatest(); return; }
    if (!session.nextRound) return;
    const updatedUsers = applyRoundToUsers(session.nextRound, users);
    updateUserStats(updatedUsers);
    confirmNextRound();
    scheduleNextRound(session.nextRound, updatedUsers, session.participantIds);
  };

  const toggleParticipant = (userId: string) => {
    if (!session) return;
    const isIn = session.participantIds.includes(userId);
    let updatedUsers = users;
    let updatedParticipantIds = session.participantIds;
    if (isIn) {
      updatedParticipantIds = session.participantIds.filter((id) => id !== userId);
      updateParticipants(updatedParticipantIds);
    } else {
      const participants = users.filter((u) => session.participantIds.includes(u.id));
      const user = users.find((u) => u.id === userId)!;
      const initialized = initLateJoiner(user, participants);
      updatedUsers = users.map((u) => (u.id === userId ? initialized : u));
      updatedParticipantIds = [...session.participantIds, userId];
      updateUserStats([initialized]);
      updateParticipants(updatedParticipantIds);
    }
    if (session.rounds.length > 0) {
      scheduleNextRound(session.rounds[session.latestRoundIndex], updatedUsers, updatedParticipantIds);
    }
  };

  if (!session) {
    return (
      <Flex h="100vh" align="center" justify="center" direction="column" gap="md">
        <Text>セッションがありません</Text>
        <Button onClick={() => router.push('/setup')}>セッション設定へ</Button>
      </Flex>
    );
  }

  const totalRounds = session.rounds.length;
  const displayIndex = session.currentRoundIndex;

  return (
    <AppShell header={{ height: 60 }} footer={{ height: 70 }} padding="md">
      <AppShell.Header>
        <Flex h="100%" px="md" align="center" justify="space-between">
          <Button color="red" variant="light" size="sm" onClick={openEnd}>← 終了</Button>
          <Text fw={700} size="lg">
            {totalRounds > 0 ? `ラウンド ${displayIndex + 1} / ${totalRounds}` : '開始前'}
          </Text>
          <Button variant="light" size="sm" onClick={openParticipants}>参加者管理</Button>
        </Flex>
      </AppShell.Header>

      <AppShell.Main>
        {/* 過去閲覧バナー */}
        {isViewing && (
          <Flex
            bg="orange.6" px="md" py="xs" mb="md" align="center" justify="space-between"
            style={{ borderRadius: 8 }}
          >
            <Text c="white" fw={600}>過去のラウンドを閲覧中</Text>
            <Button size="xs" variant="white" color="orange" onClick={goToLatest}>最新に戻る</Button>
          </Flex>
        )}

        <Stack style={{ opacity: isViewing ? 0.65 : 1 }}>
          {currentRound ? (
            <>
              <SimpleGrid cols={{ base: 1, md: session.courtCount > 1 ? 2 : 1 }} spacing="lg">
                {currentRound.courts.map((court) => (
                  <CourtCard key={court.courtNumber} court={court} users={users} />
                ))}
              </SimpleGrid>

              {currentRound.restingPlayerIds.length > 0 && (
                <Card withBorder radius="md" padding="md">
                  <Text fw={600} c="dimmed" mb="sm">休憩</Text>
                  <Group>
                    {currentRound.restingPlayerIds.map((id) => {
                      const u = users.find((u) => u.id === id);
                      return (
                        <Stack key={id} align="center" gap={4}>
                          <Avatar src={u?.imagePath} size={44} radius="xl" color="gray">
                            {u?.name[0] ?? '?'}
                          </Avatar>
                          <Text size="xs" c="dimmed">{u?.name ?? id}</Text>
                        </Stack>
                      );
                    })}
                  </Group>
                </Card>
              )}
            </>
          ) : (
            <Flex align="center" justify="center" h={300}>
              <Text c="dimmed" size="xl">「次へ」を押してゲームを開始</Text>
            </Flex>
          )}
        </Stack>
      </AppShell.Main>

      <AppShell.Footer>
        <Flex h="100%" px="md" gap="md" align="center">
          <Button
            flex={1} variant="default" size="md"
            disabled={session.currentRoundIndex <= 0}
            onClick={goBack}
          >
            ← 戻る
          </Button>
          <Button flex={2} size="md" onClick={handleNext}>
            {isViewing ? '最新へジャンプ →' : '次へ →'}
          </Button>
        </Flex>
      </AppShell.Footer>

      {/* 終了確認 */}
      <Modal opened={endOpened} onClose={closeEnd} title="セッション終了" centered>
        <Text>セッションを終了しますか？</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={closeEnd}>キャンセル</Button>
          <Button color="red" onClick={() => { endSession(); router.push('/'); }}>終了</Button>
        </Group>
      </Modal>

      {/* 参加者管理 */}
      <Modal opened={participantsOpened} onClose={closeParticipants} title="参加者管理" size="md">
        <Stack gap="sm">
          {users.map((user) => {
            const isIn = session.participantIds.includes(user.id);
            return (
              <Card
                key={user.id} withBorder radius="md" padding="sm"
                onClick={() => toggleParticipant(user.id)}
                style={{ cursor: 'pointer', borderColor: isIn ? 'var(--mantine-color-blue-5)' : undefined, borderWidth: isIn ? 2 : 1 }}
              >
                <Flex align="center" gap="sm">
                  <Avatar src={user.imagePath} size={40} radius="xl" color="blue">{user.name[0]}</Avatar>
                  <Text flex={1} fw={500}>{user.name}</Text>
                  <Badge color={isIn ? 'blue' : 'gray'}>{isIn ? '参加中' : '不参加'}</Badge>
                </Flex>
              </Card>
            );
          })}
        </Stack>
      </Modal>
    </AppShell>
  );
}

const COURT_GREEN = '#2d7a3a';

function CourtCard({ court, users }: { court: Court; users: User[] }) {
  const getUser = (id: string) => users.find((u) => u.id === id);

  const PlayerChip = ({ id }: { id: string }) => {
    const u = getUser(id);
    return (
      <Stack align="center" gap={6}>
        <Avatar
          src={u?.imagePath} size={64} radius="xl"
          style={{ border: '3px solid white' }}
          color="blue"
        >
          {u?.name[0] ?? '?'}
        </Avatar>
        <Text size="sm" fw={700} c="white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
          {u?.name ?? id}
        </Text>
      </Stack>
    );
  };

  return (
    <Card radius="md" padding={0} style={{ overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
      {/* タイトルバー */}
      <Flex bg="#1a5c28" px="md" py="xs" align="center">
        <Text c="white" fw={700}>コート {court.courtNumber}</Text>
      </Flex>

      {/* コートフィールド */}
      <Flex
        bg={COURT_GREEN} p="xl" align="center" justify="space-around"
        style={{ border: '3px solid white', borderTop: 'none', minHeight: 180 }}
      >
        {/* チームA */}
        <Stack align="center" flex={1} gap="md">
          <Text size="xs" fw={700} c="rgba(255,255,255,0.7)" style={{ letterSpacing: 2 }}>TEAM A</Text>
          <Group gap="xl" justify="center">
            {court.teamA.map((id) => <PlayerChip key={id} id={id} />)}
          </Group>
        </Stack>

        {/* ネット */}
        <Stack align="center" gap={4} mx="md">
          <Paper w={4} h={40} bg="rgba(255,255,255,0.7)" radius="sm" />
          <Text c="white" fw={900} size="lg">VS</Text>
          <Paper w={4} h={40} bg="rgba(255,255,255,0.7)" radius="sm" />
        </Stack>

        {/* チームB */}
        <Stack align="center" flex={1} gap="md">
          <Text size="xs" fw={700} c="rgba(255,255,255,0.7)" style={{ letterSpacing: 2 }}>TEAM B</Text>
          <Group gap="xl" justify="center">
            {court.teamB.map((id) => <PlayerChip key={id} id={id} />)}
          </Group>
        </Stack>
      </Flex>
    </Card>
  );
}
