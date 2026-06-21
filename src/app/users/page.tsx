'use client';
import { useState, useRef } from 'react';
import {
  AppShell, Title, TextInput, Button, Group, Stack, Avatar,
  Text, ActionIcon, Card, Badge, Flex, Modal,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTrash, IconPencil, IconCheck, IconX } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { generateId } from '@/utils/id';

export default function UsersPage() {
  const router = useRouter();
  const { users, addUser, updateUser, deleteUser, resetAllStats } = useUserStore();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [resetOpened, { open: openReset, close: closeReset }] = useDisclosure(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!name.trim()) return;
    addUser({ id: generateId(), name: name.trim() });
    setName('');
  };

  const handleImageUpload = (userId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => updateUser(userId, { imagePath: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleEditSave = (id: string) => {
    if (editName.trim()) updateUser(id, { name: editName.trim() });
    setEditingId(null);
  };

  const handleReset = () => {
    resetAllStats();
    closeReset();
  };

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Flex h="100%" px="md" align="center" justify="space-between">
          <Button variant="subtle" onClick={() => router.push('/')}>← トップ</Button>
          <Title order={3}>ユーザー管理</Title>
          <Button color="red" variant="light" onClick={openReset}>
            統計リセット
          </Button>
        </Flex>
      </AppShell.Header>

      <AppShell.Main>
        <Stack maw={800} mx="auto">
          <Group>
            <TextInput
              flex={1}
              placeholder="名前を入力してEnter"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button leftSection={<IconPlus size={16} />} onClick={handleAdd}>
              追加
            </Button>
          </Group>

          <Stack gap="sm">
            {users.map((user) => (
              <Card key={user.id} withBorder padding="sm" radius="md">
                <Flex align="center" gap="md">
                  <Stack gap={2} align="center" style={{ cursor: 'pointer' }} onClick={() => {
                    setUploadingId(user.id);
                    fileInputRef.current?.click();
                  }}>
                    <Avatar src={user.imagePath} size={52} radius="xl" color={user.color}>
                      {user.name[0]}
                    </Avatar>
                    <Text size="xs" c="dimmed">写真</Text>
                  </Stack>

                  {editingId === user.id ? (
                    <TextInput
                      flex={1}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleEditSave(user.id)}
                      autoFocus
                    />
                  ) : (
                    <Text flex={1} fw={500} size="lg">{user.name}</Text>
                  )}

                  <Badge variant="light" color="blue">{user.totalPlayCount}試合</Badge>
                  <Badge variant="light" color="gray">{user.totalRestCount}休</Badge>

                  {editingId === user.id ? (
                    <Group gap="xs">
                      <ActionIcon color="green" onClick={() => handleEditSave(user.id)}>
                        <IconCheck size={16} />
                      </ActionIcon>
                      <ActionIcon color="gray" onClick={() => setEditingId(null)}>
                        <IconX size={16} />
                      </ActionIcon>
                    </Group>
                  ) : (
                    <Group gap="xs">
                      <ActionIcon variant="light" onClick={() => { setEditingId(user.id); setEditName(user.name); }}>
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon variant="light" color="red" onClick={() => deleteUser(user.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  )}
                </Flex>
              </Card>
            ))}
            {users.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">ユーザーを追加してください</Text>
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
          if (file && uploadingId) handleImageUpload(uploadingId, file);
          e.target.value = '';
        }}
      />

      <Modal opened={resetOpened} onClose={closeReset} title="統計リセット" centered>
        <Text>参加回数・対戦履歴をリセットしますか？</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={closeReset}>キャンセル</Button>
          <Button color="red" onClick={handleReset}>終了する</Button>
        </Group>
      </Modal>
    </AppShell>
  );
}
