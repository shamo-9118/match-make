'use client';
import { useState, useRef } from 'react';
import {
  AppShell, Title, TextInput, Button, Group, Stack, Avatar,
  Text, ActionIcon, Card, Flex, Modal,
} from '@mantine/core';
import { IconPlus, IconTrash, IconPencil } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useTeamStore } from '@/store/teamStore';

export default function TeamsPage() {
  const router = useRouter();
  const { teams, addTeam, updateTeam, deleteTeam } = useTeamStore();
  const [name, setName] = useState('');
  const [editTeam, setEditTeam] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingTeam, setDeletingTeam] = useState<{ id: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!name.trim()) return;
    addTeam(name.trim());
    setName('');
  };

  const openEdit = (team: { id: string; name: string }) => {
    setEditTeam(team);
    setEditName(team.name);
  };

  const handleEditSave = () => {
    if (!editTeam) return;
    if (editName.trim()) updateTeam(editTeam.id, { name: editName.trim() });
    setEditTeam(null);
  };

  const handleLogoUpload = (teamId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => updateTeam(teamId, { logoPath: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Flex h="100%" px="md" align="center" justify="space-between" style={{ position: 'relative' }}>
          <Button variant="subtle" onClick={() => router.push('/')}>← トップ</Button>
          <Title order={4} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>チーム管理</Title>
          <div />
        </Flex>
      </AppShell.Header>

      <AppShell.Main>
        <Stack maw={800} mx="auto">
          <Group>
            <TextInput
              flex={1}
              placeholder="チーム名を入力してEnter"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={handleAdd}>
              追加
            </Button>
          </Group>

          <Stack gap="sm">
            {teams.map((team) => (
              <Card key={team.id} withBorder padding="sm" radius="md">
                <Flex align="center" gap="md">
                  <Avatar
                    src={team.logoPath} size={52} radius="md"
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => { setUploadingId(team.id); fileInputRef.current?.click(); }}
                  >
                    {team.name[0]}
                  </Avatar>
                  <Text flex={1} fw={500} size="lg">{team.name}</Text>
                  <Group gap="xs">
                    <ActionIcon variant="light" onClick={() => openEdit(team)}>
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon variant="light" color="red" onClick={() => setDeletingTeam({ id: team.id, name: team.name })}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Flex>
              </Card>
            ))}
            {teams.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">チームを追加してください</Text>
            )}
          </Stack>
        </Stack>
      </AppShell.Main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadingId) handleLogoUpload(uploadingId, file);
          e.target.value = '';
        }}
      />

      <Modal opened={!!editTeam} onClose={() => setEditTeam(null)} title="チームを編集" centered size="sm">
        <Stack gap="md">
          <TextInput
            label="チーム名"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
            autoFocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditTeam(null)}>キャンセル</Button>
            <Button onClick={handleEditSave}>保存</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={!!deletingTeam} onClose={() => setDeletingTeam(null)} title="チームを削除" centered>
        <Text>「{deletingTeam?.name}」を削除しますか？</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={() => setDeletingTeam(null)}>キャンセル</Button>
          <Button color="red" onClick={() => { deleteTeam(deletingTeam!.id); setDeletingTeam(null); }}>削除</Button>
        </Group>
      </Modal>
    </AppShell>
  );
}
