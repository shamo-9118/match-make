'use client';
import { useState, useRef } from 'react';
import {
  AppShell, Title, Button, Group, Stack, Avatar, Text, Card,
  Flex, SimpleGrid, TextInput, Modal, Badge,
  Checkbox, Alert, SegmentedControl, Divider,
} from '@mantine/core';
import { IconPlus, IconPencil, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { useTeamStore } from '@/store/teamStore';
import { useTeamBattleSessionStore } from '@/store/teamBattleSessionStore';
import { PairType, Team } from '@/types';
import { suggestPairCompositions, generateTeamBattleMatches } from '@/utils/teamBattleAlgorithm';

type Step = 'team-select' | 'members' | 'pairs' | 'composition';

export default function TeamSetupPage() {
  const router = useRouter();
  const { users: allUsers } = useUserStore();
  const users = allUsers.filter((u) => !u.archived);
  const { teams, addTeam, updateTeam, deleteTeam } = useTeamStore();
  const { startSession } = useTeamBattleSessionStore();

  const [step, setStep] = useState<Step>('team-select');

  // チーム選択
  const [selectedTeamAId, setSelectedTeamAId] = useState<string | null>(null);
  const [selectedTeamBId, setSelectedTeamBId] = useState<string | null>(null);

  // チーム編集
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoTargetId, setLogoTargetId] = useState<string | null>(null);

  // メンバー割り当て
  const [memberIdsA, setMemberIdsA] = useState<string[]>([]);
  const [memberIdsB, setMemberIdsB] = useState<string[]>([]);

  // ペア数・コート数・シングルス
  const [totalPairs, setTotalPairs] = useState<number>(3);
  const [courtCount, setCourtCount] = useState<number>(1);
  const [singlesPairs, setSinglesPairs] = useState<number>(0);

  // ペア構成
  const [selectedComposition, setSelectedComposition] = useState<PairType[] | null>(null);

  // 重複参加（案2）: 女子人数が異なる場合の調整方法
  const [adjustmentMethod, setAdjustmentMethod] = useState<'min' | 'max'>('min');
  // 案2で重複出場するプレイヤーID（同一IDが複数回含まれる場合もある）
  const [duplicatesA, setDuplicatesA] = useState<string[]>([]);
  const [duplicatesB, setDuplicatesB] = useState<string[]>([]);

  const teamA = teams.find((t) => t.id === selectedTeamAId);
  const teamB = teams.find((t) => t.id === selectedTeamBId);

  const malesA = memberIdsA.filter((id) => users.find((u) => u.id === id)?.gender === 'male').length;
  const femalesA = memberIdsA.filter((id) => users.find((u) => u.id === id)?.gender === 'female').length;
  const malesB = memberIdsB.filter((id) => users.find((u) => u.id === id)?.gender === 'male').length;
  const femalesB = memberIdsB.filter((id) => users.find((u) => u.id === id)?.gender === 'female').length;
  const femaleIdsA = memberIdsA.filter((id) => users.find((u) => u.id === id)?.gender === 'female');
  const femaleIdsB = memberIdsB.filter((id) => users.find((u) => u.id === id)?.gender === 'female');

  // 案2は両チームに1人以上女子がいる場合のみ有効
  const canUseCase2 = femalesA !== femalesB && Math.min(femalesA, femalesB) > 0;

  // 案2の場合は女子数が多い方に合わせた構成をサジェスト
  const effectiveFemales = adjustmentMethod === 'max' && canUseCase2
    ? Math.max(femalesA, femalesB)
    : undefined;
  const suggestions = step === 'composition'
    ? suggestPairCompositions(
        malesA, effectiveFemales ?? femalesA,
        malesB, effectiveFemales ?? femalesB,
        totalPairs, singlesPairs,
      )
    : [];

  // 選択した構成で各チームに必要な女子数と不足数
  const femalesNeededPerTeam = selectedComposition
    ? selectedComposition.filter((t) => t === 'womens').length * 2
      + selectedComposition.filter((t) => t === 'mixed').length
    : 0;
  const extraNeededA = adjustmentMethod === 'max' ? Math.max(0, femalesNeededPerTeam - femalesA) : 0;
  const extraNeededB = adjustmentMethod === 'max' ? Math.max(0, femalesNeededPerTeam - femalesB) : 0;
  const duplicatesReady = duplicatesA.length >= extraNeededA && duplicatesB.length >= extraNeededB;

  const isEvenPairs = totalPairs % 2 === 0;

  const handleAddTeam = () => {
    if (!newTeamName.trim()) return;
    addTeam(newTeamName.trim());
    setNewTeamName('');
  };

  const handleLogoUpload = (file: File) => {
    if (!logoTargetId) return;
    const reader = new FileReader();
    reader.onload = (e) => updateTeam(logoTargetId, { logoPath: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleStart = () => {
    if (!teamA || !teamB || !selectedComposition) return;
    // 案2の場合、重複出場分のIDを追加した配列をアルゴリズムに渡す
    const effectiveMemberIdsA = [...memberIdsA, ...duplicatesA];
    const effectiveMemberIdsB = [...memberIdsB, ...duplicatesB];
    const matches = generateTeamBattleMatches(
      teamA.id, effectiveMemberIdsA,
      teamB.id, effectiveMemberIdsB,
      users,
      selectedComposition,
      courtCount,
    );
    // セッションには元のメンバー構成（重複なし）を保存
    startSession(
      { ...teamA, memberIds: memberIdsA },
      { ...teamB, memberIds: memberIdsB },
      matches,
      courtCount,
    );
    router.push('/session/team');
  };

  const handleBack = () => {
    if (step === 'team-select') { router.push('/setup'); return; }
    if (step === 'members') { setStep('team-select'); return; }
    if (step === 'pairs') {
      setAdjustmentMethod('min');
      setDuplicatesA([]);
      setDuplicatesB([]);
      setStep('members');
      return;
    }
    // composition → pairs
    setSelectedComposition(null);
    setDuplicatesA([]);
    setDuplicatesB([]);
    setStep('pairs');
  };

  const compositionLabel = (comp: PairType[]) => {
    const counts: Partial<Record<PairType, number>> = {};
    for (const p of comp) counts[p] = (counts[p] ?? 0) + 1;
    return Object.entries(counts)
      .map(([type, count]) => {
        const label = { mens: '男子', womens: '女子', mixed: 'ミックス', singles: 'シングルス' }[type as PairType];
        return `${label} × ${count}`;
      })
      .join('、');
  };

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Flex h="100%" px="md" align="center" justify="space-between">
          <Button variant="subtle" onClick={handleBack}>← 戻る</Button>
          <Title order={4}>団体戦設定</Title>
          <Text size="sm" c="dimmed">
            {{ 'team-select': '1/4', members: '2/4', pairs: '3/4', composition: '4/4' }[step]}
          </Text>
        </Flex>
      </AppShell.Header>

      <AppShell.Main>
        <Stack maw={900} mx="auto" gap="lg">

          {/* Step 1: チーム選択 */}
          {step === 'team-select' && (
            <Stack gap="md">
              <Title order={4}>チームを選択</Title>

              {/* 新規追加 */}
              <Group>
                <TextInput
                  flex={1} placeholder="チーム名を入力"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()}
                />
                <Button leftSection={<IconPlus size={16} />} onClick={handleAddTeam}>追加</Button>
              </Group>

              {/* チーム一覧 */}
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {teams.map((team) => {
                  const isA = selectedTeamAId === team.id;
                  const isB = selectedTeamBId === team.id;
                  return (
                    <Card key={team.id} withBorder radius="md" padding="sm"
                      style={{
                        borderColor: isA ? 'var(--mantine-color-blue-5)' : isB ? 'var(--mantine-color-orange-5)' : undefined,
                        borderWidth: (isA || isB) ? 2 : 1,
                      }}
                    >
                      <Flex align="center" gap="sm">
                        <Avatar
                          src={team.logoPath} size={48} radius="md"
                          style={{ cursor: 'pointer' }}
                          onClick={() => { setLogoTargetId(team.id); logoInputRef.current?.click(); }}
                        >
                          {team.name[0]}
                        </Avatar>
                        <Stack gap={2} flex={1}>
                          {editingTeam?.id === team.id ? (
                            <TextInput
                              size="xs" value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { updateTeam(team.id, { name: editName }); setEditingTeam(null); }
                                if (e.key === 'Escape') setEditingTeam(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <Text fw={600}>{team.name}</Text>
                          )}
                          <Group gap={4}>
                            {isA && <Badge size="xs" color="blue">チームA</Badge>}
                            {isB && <Badge size="xs" color="orange">チームB</Badge>}
                          </Group>
                        </Stack>
                        <Group gap={4}>
                          <Button size="xs" variant={isA ? 'filled' : 'light'} color="blue" disabled={isB}
                            onClick={() => setSelectedTeamAId(isA ? null : team.id)}>A</Button>
                          <Button size="xs" variant={isB ? 'filled' : 'light'} color="orange" disabled={isA}
                            onClick={() => setSelectedTeamBId(isB ? null : team.id)}>B</Button>
                          <Button size="xs" variant="subtle" color="gray"
                            onClick={() => { setEditingTeam(team); setEditName(team.name); }}>
                            <IconPencil size={14} />
                          </Button>
                          <Button size="xs" variant="subtle" color="red"
                            onClick={() => deleteTeam(team.id)}>
                            <IconTrash size={14} />
                          </Button>
                        </Group>
                      </Flex>
                    </Card>
                  );
                })}
              </SimpleGrid>

              {teams.length === 0 && (
                <Text c="dimmed" ta="center" py="xl">チームを追加してください</Text>
              )}

              <Button size="lg" color="green"
                disabled={!selectedTeamAId || !selectedTeamBId}
                onClick={() => setStep('members')}
              >
                次へ →
              </Button>
            </Stack>
          )}

          {/* Step 2: メンバー割り当て */}
          {step === 'members' && (
            <Stack gap="md">
              <Title order={4}>メンバーを割り当て</Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                {([
                  { team: teamA!, label: 'チームA', color: 'blue', memberIds: memberIdsA, setMemberIds: setMemberIdsA },
                  { team: teamB!, label: 'チームB', color: 'orange', memberIds: memberIdsB, setMemberIds: setMemberIdsB },
                ] as const).map(({ team, label, color, memberIds, setMemberIds }) => (
                  <Stack key={team.id} gap="xs">
                    <Flex align="center" gap="sm">
                      <Avatar src={team.logoPath} size={32} radius="md">{team.name[0]}</Avatar>
                      <Text fw={700}>{team.name}</Text>
                      <Badge color={color}>{label}</Badge>
                      <Text size="sm" c="dimmed" ml="auto">{memberIds.length}人</Text>
                    </Flex>
                    <Stack gap="xs">
                      {users.map((user) => {
                        const checked = memberIds.includes(user.id);
                        const inOther = (color === 'blue' ? memberIdsB : memberIdsA).includes(user.id);
                        const genderLabel = user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : null;
                        return (
                          <Card key={user.id} withBorder radius="md" padding="xs"
                            style={{
                              cursor: inOther ? 'not-allowed' : 'pointer',
                              opacity: inOther ? 0.4 : 1,
                              borderColor: checked ? `var(--mantine-color-${color}-5)` : undefined,
                              borderWidth: checked ? 2 : 1,
                            }}
                            onClick={() => {
                              if (inOther) return;
                              setMemberIds(checked ? memberIds.filter((id) => id !== user.id) : [...memberIds, user.id]);
                            }}
                          >
                            <Flex align="center" gap="sm">
                              <Avatar src={user.imagePath} size={32} radius="xl" color={user.color}>{user.name[0]}</Avatar>
                              <Text flex={1} size="sm" fw={500}>{user.name}</Text>
                              {genderLabel && <Badge size="xs" variant="light" color={user.gender === 'male' ? 'blue' : 'pink'}>{genderLabel}</Badge>}
                              <Checkbox checked={checked} readOnly size="sm" />
                            </Flex>
                          </Card>
                        );
                      })}
                    </Stack>
                  </Stack>
                ))}
              </SimpleGrid>

              <Button size="lg" color="green"
                disabled={memberIdsA.length === 0 || memberIdsB.length === 0}
                onClick={() => setStep('pairs')}
              >
                次へ →
              </Button>
            </Stack>
          )}

          {/* Step 3: ペア数・コート数 */}
          {step === 'pairs' && (
            <Stack gap="md">
              <Title order={4}>ペア数・コート数</Title>
              <Card withBorder radius="md" padding="md">
                <Stack gap="xl">
                  {/* ペア数 */}
                  <Stack gap={6}>
                    <Text fw={600}>ペア数（試合数）</Text>
                    <Text size="xs" c="dimmed">奇数推奨（引き分けが発生しない）</Text>
                    <Group gap={0} align="center">
                      <Button variant="default" size="xl" w={64} px={0} fz="xl" fw={900}
                        disabled={totalPairs <= 1}
                        onClick={() => {
                          const next = totalPairs - 1;
                          setTotalPairs(next);
                          if (singlesPairs > next) setSinglesPairs(next);
                        }}>−</Button>
                      <Text fw={900} ta="center" style={{ fontSize: '2.5rem', minWidth: 72 }}>{totalPairs}</Text>
                      <Button variant="default" size="xl" w={64} px={0} fz="xl" fw={900}
                        disabled={totalPairs >= 9}
                        onClick={() => setTotalPairs(totalPairs + 1)}>+</Button>
                    </Group>
                    {isEvenPairs && (
                      <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
                        ペア数が偶数のため引き分けが発生する可能性があります
                      </Alert>
                    )}
                  </Stack>

                  <Divider />

                  {/* シングルス枠 */}
                  <Stack gap={6}>
                    <Text fw={600}>シングルス枠</Text>
                    <Text size="xs" c="dimmed">ダブルス以外の1対1試合の数</Text>
                    <Group gap={0} align="center">
                      <Button variant="default" size="xl" w={64} px={0} fz="xl" fw={900}
                        disabled={singlesPairs <= 0}
                        onClick={() => setSinglesPairs(singlesPairs - 1)}>−</Button>
                      <Text fw={900} ta="center" style={{ fontSize: '2.5rem', minWidth: 72 }}>{singlesPairs}</Text>
                      <Button variant="default" size="xl" w={64} px={0} fz="xl" fw={900}
                        disabled={singlesPairs >= totalPairs}
                        onClick={() => setSinglesPairs(singlesPairs + 1)}>+</Button>
                    </Group>
                  </Stack>

                  <Divider />

                  {/* コート数 */}
                  <Stack gap={6}>
                    <Text fw={600}>コート数</Text>
                    <Group gap={0} align="center">
                      <Button variant="default" size="xl" w={64} px={0} fz="xl" fw={900}
                        disabled={courtCount <= 1}
                        onClick={() => setCourtCount(courtCount - 1)}>−</Button>
                      <Text fw={900} ta="center" style={{ fontSize: '2.5rem', minWidth: 72 }}>{courtCount}</Text>
                      <Button variant="default" size="xl" w={64} px={0} fz="xl" fw={900}
                        disabled={courtCount >= 4}
                        onClick={() => setCourtCount(courtCount + 1)}>+</Button>
                    </Group>
                  </Stack>
                </Stack>
              </Card>

              {/* 案1/案2 選択（女子人数が異なり、かつ案2が有効な場合のみ） */}
              {canUseCase2 && (
                <Card withBorder radius="md" padding="md">
                  <Stack gap="sm">
                    <Text fw={600} size="sm">女子人数の調整方法</Text>
                    <Text size="xs" c="dimmed">
                      {teamA!.name}: 女子 {femalesA}人 / {teamB!.name}: 女子 {femalesB}人
                    </Text>
                    <SegmentedControl
                      value={adjustmentMethod}
                      onChange={(v) => {
                        setAdjustmentMethod(v as 'min' | 'max');
                        setSelectedComposition(null);
                        setDuplicatesA([]);
                        setDuplicatesB([]);
                      }}
                      data={[
                        { label: '案1: 少ない方に合わせる', value: 'min' },
                        { label: '案2: 重複参加で揃える', value: 'max' },
                      ]}
                    />
                    <Text size="xs" c="dimmed">
                      {adjustmentMethod === 'min'
                        ? `女子が少ない方（${Math.min(femalesA, femalesB)}人）に合わせた構成をサジェストします`
                        : `女子が多い方（${Math.max(femalesA, femalesB)}人）に合わせた構成で、不足チームの選手が複数試合に出場します`}
                    </Text>
                  </Stack>
                </Card>
              )}

              <Button size="lg" color="green" onClick={() => { setSelectedComposition(null); setDuplicatesA([]); setDuplicatesB([]); setStep('composition'); }}>
                次へ →
              </Button>
            </Stack>
          )}

          {/* Step 4: ペア構成 */}
          {step === 'composition' && (
            <Stack gap="md">
              <Title order={4}>ペア構成を選択</Title>
              <Text size="sm" c="dimmed">
                両チームで同じ構成になるようにサジェストしています（ペア {totalPairs} / シングルス {singlesPairs}）
              </Text>

              {suggestions.length > 0 ? (
                <Stack gap="sm">
                  {suggestions.map((comp, i) => {
                    const label = compositionLabel(comp);
                    const isSelected = selectedComposition && JSON.stringify(comp) === JSON.stringify(selectedComposition);
                    return (
                      <Card key={i} withBorder radius="md" padding="sm"
                        style={{
                          cursor: 'pointer',
                          borderColor: isSelected ? 'var(--mantine-color-blue-5)' : undefined,
                          borderWidth: isSelected ? 2 : 1,
                          backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : undefined,
                        }}
                        onClick={() => { setSelectedComposition(comp); setDuplicatesA([]); setDuplicatesB([]); }}
                      >
                        <Flex align="center" gap="sm">
                          <Checkbox checked={!!isSelected} readOnly />
                          <Text>{label}</Text>
                        </Flex>
                      </Card>
                    );
                  })}
                </Stack>
              ) : (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                  現在の男女人数でペア構成を作れませんでした。メンバーの性別設定を確認してください。
                </Alert>
              )}

              {/* 重複出場選手の選択（案2かつ選択済み構成で不足がある場合） */}
              {adjustmentMethod === 'max' && selectedComposition && (extraNeededA > 0 || extraNeededB > 0) && (
                <Card withBorder radius="md" padding="md" style={{ borderColor: 'var(--mantine-color-orange-3)' }}>
                  <Stack gap="md">
                    <Text fw={600} size="sm">重複出場選手の選択</Text>
                    {([
                      { teamName: teamA!.name, femaleIds: femaleIdsA, duplicates: duplicatesA, setDuplicates: setDuplicatesA, extraNeeded: extraNeededA },
                      { teamName: teamB!.name, femaleIds: femaleIdsB, duplicates: duplicatesB, setDuplicates: setDuplicatesB, extraNeeded: extraNeededB },
                    ]).filter(({ extraNeeded }) => extraNeeded > 0).map(({ teamName, femaleIds, duplicates, setDuplicates, extraNeeded }) => (
                      <Stack key={teamName} gap="xs">
                        <Divider label={teamName} labelPosition="left" />
                        <Text size="sm" c="dimmed">
                          あと {extraNeeded - duplicates.length} 人分選択してください
                        </Text>
                        <Group gap="sm">
                          {femaleIds.map((id) => {
                            const u = users.find((u) => u.id === id);
                            const count = duplicates.filter((d) => d === id).length;
                            return (
                              <Stack key={id} align="center" gap={4}>
                                <Avatar src={u?.imagePath} size={40} radius="xl" color={u?.color ?? 'gray'}>{u?.name[0]}</Avatar>
                                <Text size="xs" ta="center">{u?.name}</Text>
                                {count > 0 && <Badge size="xs" color="orange">+{count}回</Badge>}
                                <Group gap={4}>
                                  <Button size="xs" variant="light" color="orange"
                                    disabled={duplicates.length >= extraNeeded}
                                    onClick={() => setDuplicates([...duplicates, id])}>+</Button>
                                  {count > 0 && (
                                    <Button size="xs" variant="subtle" color="red"
                                      onClick={() => {
                                        const lastIdx = duplicates.map((d, i) => ({ d, i })).filter(({ d }) => d === id).at(-1)!.i;
                                        setDuplicates(duplicates.filter((_, i) => i !== lastIdx));
                                      }}>−</Button>
                                  )}
                                </Group>
                              </Stack>
                            );
                          })}
                        </Group>
                      </Stack>
                    ))}
                  </Stack>
                </Card>
              )}

              <Button size="lg" color="green"
                disabled={!selectedComposition || !duplicatesReady}
                onClick={handleStart}
              >
                ゲーム開始 →
              </Button>
            </Stack>
          )}
        </Stack>
      </AppShell.Main>

      {/* ロゴアップロード */}
      <input
        ref={logoInputRef} type="file" accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }}
      />
    </AppShell>
  );
}
