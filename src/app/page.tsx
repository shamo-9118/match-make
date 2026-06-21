'use client';
import { Flex, Title, Button, Stack, Text } from '@mantine/core';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  return (
    <Flex h="100vh" direction="column" align="center" justify="center" gap="xl">
      <Stack align="center" gap="xs">
        <Title order={1}>match-make 🏓</Title>
        <Text c="dimmed">ピックルボール コート割り振りアプリ</Text>
      </Stack>

      <Stack w={280} gap="md">
        <Button size="xl" color="green" onClick={() => router.push('/setup')}>
          ゲーム
        </Button>
        <Button size="xl" variant="light" onClick={() => router.push('/users')}>
          ユーザー管理
        </Button>
      </Stack>
    </Flex>
  );
}
