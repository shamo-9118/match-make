'use client';
import { useState } from 'react';
import {
  AppShell, Title, Button, Group, Stack, Avatar, Text, Card,
  Flex, SegmentedControl, SimpleGrid, Checkbox,
} from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { useSessionStore } from '@/store/sessionStore';
import { GameFormat } from '@/types';
import { generateRound } from '@/utils/algorithm';

export default function SetupPage() {
  const router = useRouter();
  const { users } = useUserStore();
  const { startSession, setNextRound } = useSessionStore();

  const [courtCount, setCourtCount] = useState(2);
  const [gameFormat, setGameFormat] = useState<GameFormat>('doubles');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sortedUsers = [...users].sort((a, b) => b.totalPlayCount - a.totalPlayCount);
  const playersPerCourt = gameFormat === 'doubles' ? 4 : 2;
  const minRequired = courtCount * playersPerCourt;
  const canStart = selectedIds.size >= minRequired;

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleStart = () => {
    const participantIds = [...selectedIds];
    startSession(courtCount, gameFormat, participantIds);
    const participants = users.filter((u) => participantIds.includes(u.id));
    const firstRound = generateRound(participants, courtCount, gameFormat, null, 0);
    setNextRound(firstRound);
    router.push('/session');
  };

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Flex h="100%" px="md" align="center" justify="space-between">
          <Title order={3}>match-make 🏓</Title>
          <Button variant="subtle" onClick={() => router.push('/')}>← トップ</Button>
        </Flex>
      </AppShell.Header>

      <AppShell.Main>
        <Stack maw={900} mx="auto" gap="lg">
          <Title order={4}>ゲーム設定</Title>

          {/* コート数 */}
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Text fw={600}>コート数</Text>
              <SegmentedControl
                value={String(courtCount)}
                onChange={(v) => setCourtCount(Number(v))}
                data={['1', '2', '3', '4'].map((n) => ({ label: `${n}コート`, value: n }))}
                w="fit-content"
              />
            </Stack>
          </Card>

          {/* ゲーム形式 */}
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Text fw={600}>ゲーム形式</Text>
              <SegmentedControl
                value={gameFormat}
                onChange={(v) => setGameFormat(v as GameFormat)}
                data={[
                  { label: 'ダブルス (2vs2)', value: 'doubles' },
                  { label: 'シングルス (1vs1)', value: 'singles' },
                ]}
                w="fit-content"
              />
            </Stack>
          </Card>

          {/* 参加者選択 */}
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Flex align="center" gap="sm">
                <Text fw={600}>参加者選択</Text>
                <Text size="sm" c="dimmed">{selectedIds.size}人選択中</Text>
                {!canStart && selectedIds.size > 0 && (
                  <Text size="sm" c="red">（最低{minRequired}人必要）</Text>
                )}
              </Flex>
              <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                {sortedUsers.map((user) => {
                  const selected = selectedIds.has(user.id);
                  return (
                    <Card
                      key={user.id}
                      withBorder
                      radius="md"
                      padding="sm"
                      onClick={() => toggleUser(user.id)}
                      style={{
                        cursor: 'pointer',
                        borderColor: selected ? 'var(--mantine-color-blue-5)' : undefined,
                        borderWidth: selected ? 2 : 1,
                        backgroundColor: selected ? 'var(--mantine-color-blue-0)' : undefined,
                      }}
                    >
                      <Flex align="center" gap="sm">
                        <Avatar src={user.imagePath} size={40} radius="xl" color="blue">
                          {user.name[0]}
                        </Avatar>
                        <Text fw={500} size="sm" flex={1}>{user.name}</Text>
                        {selected && <Checkbox checked readOnly size="sm" />}
                      </Flex>
                    </Card>
                  );
                })}
              </SimpleGrid>
            </Stack>
          </Card>

          <Button size="lg" disabled={!canStart} onClick={handleStart} color="green">
            ゲーム開始 →
          </Button>
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
