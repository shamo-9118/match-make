'use client';
import { useEffect, useState } from 'react';
import { Flex, Title, Button, Stack, Text, Modal, Avatar, Group, Card, Image } from '@mantine/core';
import { IconSwords, IconUsers } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { generateId } from '@/utils/id';

type ImportUser = { name: string; color: string; gender?: string };

export default function HomePage() {
  const router = useRouter();
  const { addUser, updateUser } = useUserStore();
  const [importUsers, setImportUsers] = useState<ImportUser[]>([]);
  const [importOpened, setImportOpened] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('import');
    if (!raw) return;
    try {
      const parsed: ImportUser[] = JSON.parse(decodeURIComponent(atob(raw)));
      if (Array.isArray(parsed) && parsed.length > 0) {
        setImportUsers(parsed);
        setImportOpened(true);
      }
    } catch {}
    // URLパラメータを除去
    window.history.replaceState({}, '', '/');
  }, []);

  const handleImport = () => {
    importUsers.forEach((u) => {
      const id = generateId();
      addUser({ id, name: u.name });
      updateUser(id, {
        color: u.color,
        gender: u.gender === 'male' || u.gender === 'female' ? u.gender : null,
      });
    });
    setImportOpened(false);
  };

  return (
    <>
      <Flex h="100vh" direction="column" align="center" justify="center" gap="xl">
        <Stack w={280} align="center" gap="md">
          <Image src="/app-icon.png" w={280} radius="xl" />
          <Text c="dimmed" ta="center">コートスポーツのメンバー割り振りをお任せ！</Text>
          <Button w="100%" size="xl" color="green" leftSection={<IconSwords size={24} />} onClick={() => router.push('/setup')}>
            ゲーム
          </Button>
          <Button w="100%" size="xl" variant="light" leftSection={<IconUsers size={24} />} onClick={() => router.push('/users')}>
            ユーザー管理
          </Button>
        </Stack>
      </Flex>

      <Modal opened={importOpened} onClose={() => setImportOpened(false)} title="ユーザーをインポート" centered>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">以下のユーザーを追加しますか？</Text>
          {importUsers.map((u, i) => (
            <Card key={i} withBorder radius="md" padding="sm">
              <Group gap="sm">
                <Avatar size={36} radius="xl" color={u.color}>{u.name[0]}</Avatar>
                <Text fw={500}>{u.name}</Text>
              </Group>
            </Card>
          ))}
          <Group mt="xs" justify="flex-end">
            <Button variant="default" onClick={() => setImportOpened(false)}>キャンセル</Button>
            <Button onClick={handleImport}>追加する</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
