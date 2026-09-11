'use client';
import { useState } from 'react';
import {
  AppShell, Title, Button, Group, Stack, Avatar, Text, Card, Badge,
  Flex, SegmentedControl, SimpleGrid, Checkbox, Modal, ThemeIcon,
} from '@mantine/core';
import { IconSwords, IconUsers, IconMapPin } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { useLocationStore } from '@/store/locationStore';
import { useSessionStore } from '@/store/sessionStore';
import { GameFormat } from '@/types';
import { generateRound } from '@/utils/algorithm';

export default function SetupPage() {
  const router = useRouter();
  const { users: allUsers, resetAllStats } = useUserStore();
  const users = allUsers.filter((u) => !u.archived);
  const { locations } = useLocationStore();
  const { startSession, setNextRound } = useSessionStore();

  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [courtCount, setCourtCount] = useState(2);
  const [gameFormat, setGameFormat] = useState<GameFormat>('doubles');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resetConfirmOpened, setResetConfirmOpened] = useState(false);

  // 場所でフィルター（場所未選択なら全員、選択時はその場所に属するユーザー + 場所未設定ユーザー）
  // selectedLocation にはlocation IDが入る
  const filteredUsers = selectedLocation
    ? users.filter((u) => !u.locations || u.locations.length === 0 || u.locations.includes(selectedLocation))
    : users;

  const sortedUsers = [...filteredUsers].sort((a, b) => b.totalPlayCount - a.totalPlayCount);
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

  const startGame = (shouldReset: boolean) => {
    if (shouldReset) resetAllStats();
    const participantIds = [...selectedIds];
    startSession(courtCount, gameFormat, participantIds);
    const participants = users.filter((u) => participantIds.includes(u.id));
    const firstRound = generateRound(participants, courtCount, gameFormat, [], 0);
    setNextRound(firstRound);
    router.push('/session');
  };

  const handleStart = () => {
    // 選択した参加者のいずれかに統計が残っていれば確認を挟む
    const hasStats = users
      .filter((u) => selectedIds.has(u.id))
      .some((u) => u.totalPlayCount > 0 || u.totalRestCount > 0);
    if (hasStats) {
      setResetConfirmOpened(true);
    } else {
      startGame(false);
    }
  };

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Flex h="100%" px="md" align="center" justify="space-between">
          <Title order={3}>match make</Title>
          <Button variant="subtle" onClick={() => router.push('/')}>← トップ</Button>
        </Flex>
      </AppShell.Header>

      <AppShell.Main>
        <Stack maw={900} mx="auto" gap="lg">
          {/* モード選択 */}
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Text fw={600}>モード</Text>
              <Group gap="sm">
                <Card
                  withBorder radius="md" padding="sm" flex={1}
                  style={{ cursor: 'pointer', borderColor: 'var(--mantine-color-blue-5)', borderWidth: 2, backgroundColor: 'var(--mantine-color-blue-0)' }}
                >
                  <Flex align="center" gap="sm">
                    <ThemeIcon variant="light" color="blue"><IconSwords size={16} /></ThemeIcon>
                    <Text fw={600} size="sm">個人戦</Text>
                  </Flex>
                </Card>
                <Card
                  withBorder radius="md" padding="sm" flex={1}
                  style={{ cursor: 'pointer' }}
                  onClick={() => router.push('/setup/team')}
                >
                  <Flex align="center" gap="sm">
                    <ThemeIcon variant="light" color="gray"><IconUsers size={16} /></ThemeIcon>
                    <Text fw={600} size="sm" c="dimmed">団体戦</Text>
                  </Flex>
                </Card>
              </Group>
            </Stack>
          </Card>

          <Title order={4}>ゲーム設定</Title>

          {/* 場所フィルター */}
          {locations.length > 0 && (
            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Flex align="center" gap="xs">
                  <IconMapPin size={16} />
                  <Text fw={600}>練習場所</Text>
                </Flex>
                <Group gap="xs" wrap="wrap">
                  <Badge
                    variant={selectedLocation === null ? 'filled' : 'light'}
                    color="gray"
                    size="lg"
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setSelectedLocation(null); setSelectedIds(new Set()); }}
                  >
                    すべて
                  </Badge>
                  {locations.map((loc) => (
                    <Badge
                      key={loc.id}
                      variant={selectedLocation === loc.id ? 'filled' : 'light'}
                      color="teal"
                      size="lg"
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setSelectedLocation(loc.id); setSelectedIds(new Set()); }}
                    >
                      {loc.name}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </Card>
          )}

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
              {(() => {
                const males = sortedUsers.filter((u) => u.gender === 'male');
                const females = sortedUsers.filter((u) => u.gender === 'female');
                const unset = sortedUsers.filter((u) => u.gender == null);
                const sections: { label: string; color: string; users: typeof sortedUsers }[] = [];
                if (males.length > 0) sections.push({ label: '男性', color: 'blue', users: males });
                if (females.length > 0) sections.push({ label: '女性', color: 'pink', users: females });
                if (unset.length > 0) sections.push({ label: '性別未設定', color: 'gray', users: unset });
                return sections.map((section) => {
                  const sectionSelected = section.users.filter((u) => selectedIds.has(u.id)).length;
                  const allSelected = sectionSelected === section.users.length;
                  const toggleAll = () => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (allSelected) {
                        section.users.forEach((u) => next.delete(u.id));
                      } else {
                        section.users.forEach((u) => next.add(u.id));
                      }
                      return next;
                    });
                  };
                  return (
                    <Stack key={section.label} gap="xs">
                      <Flex align="center" gap="xs">
                        <Badge variant="light" color={section.color}>{section.label}</Badge>
                        <Text size="xs" c="dimmed">{sectionSelected}/{section.users.length}</Text>
                        <Button size="compact-xs" variant="subtle" color={section.color} onClick={toggleAll}>
                          {allSelected ? '全解除' : '全選択'}
                        </Button>
                      </Flex>
                      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                        {section.users.map((user) => {
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
                                <Avatar src={user.imagePath} size={40} radius="xl" color={user.color}>
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
                  );
                });
              })()}
            </Stack>
          </Card>

          <Button size="lg" disabled={!canStart} onClick={handleStart} color="green">
            ゲーム開始 →
          </Button>
        </Stack>
      </AppShell.Main>

      <Modal
        opened={resetConfirmOpened}
        onClose={() => setResetConfirmOpened(false)}
        title="統計が残っています"
        centered
      >
        <Text size="sm">参加者に前回の統計が残っています。引き継いでゲームを開始しますか？</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={() => { setResetConfirmOpened(false); startGame(false); }}>
            引き継ぐ
          </Button>
          <Button color="red" onClick={() => { setResetConfirmOpened(false); startGame(true); }}>
            リセットして開始
          </Button>
        </Group>
      </Modal>
    </AppShell>
  );
}
