'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  AppShell, Title, TextInput, Button, Group, Stack, Avatar,
  Text, ActionIcon, Card, Badge, Flex, Modal, ColorSwatch, SimpleGrid, Checkbox,
  Burger, Drawer, SegmentedControl,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTrash, IconPencil } from '@tabler/icons-react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { generateId } from '@/utils/id';
import { USER_COLORS } from '@/utils/colors';

export default function UsersPage() {
  const router = useRouter();
  const { users, addUser, updateUser, deleteUser, resetAllStats, resetTeamBattleStats } = useUserStore();
  const [name, setName] = useState('');
  const [editModalUser, setEditModalUser] = useState<{ id: string; name: string; color: string; gender: string } | null>(null);
  const [editModalName, setEditModalName] = useState('');
  const [editModalColor, setEditModalColor] = useState('');
  const [editModalGender, setEditModalGender] = useState<string>('null');
  const [resetTeamBattleOpened, { open: openResetTeamBattle, close: closeResetTeamBattle }] = useDisclosure(false);
  const [resetOpened, { open: openReset, close: closeReset }] = useDisclosure(false);
  const [deletingUser, setDeletingUser] = useState<{ id: string; name: string } | null>(null);
  const [shareOpened, { open: openShare, close: closeShare }] = useDisclosure(false);
  const [menuOpened, { open: openMenu, close: closeMenu }] = useDisclosure(false);
  const [selectedShareIds, setSelectedShareIds] = useState<Set<string>>(new Set());
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // QRスキャナー
  const [scanOpened, setScanOpened] = useState(false);
  const [importUsers, setImportUsers] = useState<{ name: string; color: string }[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const parseQrData = useCallback((data: string) => {
    try {
      const url = new URL(data);
      const raw = url.searchParams.get('import');
      if (!raw) throw new Error();
      const parsed = JSON.parse(decodeURIComponent(atob(raw)));
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error();
      setImportUsers(parsed);
    } catch {
      setScanError('QRコードを認識できませんでした');
    }
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) {
      stopCamera();
      parseQrData(code.data);
    } else {
      rafRef.current = requestAnimationFrame(scanFrame);
    }
  }, [stopCamera, parseQrData]);

  const openScanner = async () => {
    setImportUsers([]);
    setScanError(null);
    setScanOpened(true);
  };

  useEffect(() => {
    if (!scanOpened || importUsers.length > 0 || scanError) return;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          rafRef.current = requestAnimationFrame(scanFrame);
        }
      } catch {
        setScanError('カメラへのアクセスが許可されていません');
      }
    })();
    return () => stopCamera();
  }, [scanOpened, importUsers.length, scanError, scanFrame, stopCamera]);

  const handleScanClose = () => {
    stopCamera();
    setScanOpened(false);
    setImportUsers([]);
    setScanError(null);
  };

  const handleImport = () => {
    importUsers.forEach((u) => {
      const id = generateId();
      addUser({ id, name: u.name });
      updateUser(id, { color: u.color });
    });
    handleScanClose();
  };

  const toggleShareUser = (id: string) => {
    setSelectedShareIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const generateQr = () => {
    const selected = users.filter((u) => selectedShareIds.has(u.id));
    const data = selected.map((u) => ({ name: u.name, color: u.color }));
    const encoded = btoa(encodeURIComponent(JSON.stringify(data)));
    const url = `${window.location.origin}/?import=${encoded}`;
    setQrUrl(url);
  };

  const handleShareClose = () => {
    closeShare();
    setSelectedShareIds(new Set());
    setQrUrl(null);
  };

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

  const openEditModal = (user: { id: string; name: string; color: string; gender: string }) => {
    setEditModalUser(user);
    setEditModalName(user.name);
    setEditModalColor(user.color);
    setEditModalGender(user.gender ?? 'null');
  };

  const handleEditSave = () => {
    if (!editModalUser) return;
    if (editModalName.trim()) updateUser(editModalUser.id, { name: editModalName.trim() });
    updateUser(editModalUser.id, {
      color: editModalColor,
      gender: editModalGender === 'null' ? null : editModalGender as 'male' | 'female',
    });
    setEditModalUser(null);
  };

  const handleReset = () => {
    resetAllStats();
    closeReset();
  };

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Flex h="100%" px="md" align="center" justify="space-between" style={{ position: 'relative' }}>
          <Button variant="subtle" onClick={() => router.push('/')}>← トップ</Button>
          <Title order={4} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>ユーザー管理</Title>

          {/* PC */}
          <Group gap="xs" visibleFrom="md">
            <Button variant="light" onClick={openScanner}>インポート</Button>
            <Button variant="light" onClick={openShare}>共有</Button>
            <Button color="orange" variant="light" onClick={openResetTeamBattle}>団体戦統計リセット</Button>
            <Button color="red" variant="light" onClick={openReset}>統計リセット</Button>
          </Group>

          {/* モバイル・タブレット: ハンバーガー */}
          <Burger hiddenFrom="md" opened={menuOpened} onClick={menuOpened ? closeMenu : openMenu} size="sm" />
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
                {/* モバイル: 2行レイアウト */}
                <Stack hiddenFrom="sm" gap="xs">
                  <Flex align="center" gap="md">
                    <Avatar
                      src={user.imagePath} size={48} radius="xl" color={user.color}
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => { setUploadingId(user.id); fileInputRef.current?.click(); }}
                    >
                      {user.name[0]}
                    </Avatar>
                    <Text flex={1} fw={500} size="md">{user.name}</Text>
                  </Flex>
                  <Flex justify="space-between" align="center">
                    <Group gap="xs">
                      <Badge variant="light" color="blue" size="sm">{user.totalPlayCount}試合</Badge>
                      <Badge variant="light" color="gray" size="sm">{user.totalRestCount}休</Badge>
                      <Badge variant="light" size="sm"
                        color={user.gender === 'male' ? 'blue' : user.gender === 'female' ? 'pink' : 'gray'}
                      >
                        {user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : '性別未設定'}
                      </Badge>
                    </Group>
                    <Group gap="xs">
                      <ActionIcon variant="light" size="sm" onClick={() => openEditModal({ ...user, gender: user.gender ?? 'null' })}>
                        <IconPencil size={14} />
                      </ActionIcon>
                      <ActionIcon variant="light" color="red" size="sm" onClick={() => setDeletingUser({ id: user.id, name: user.name })}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Flex>
                </Stack>

                {/* タブレット/PC: 1行レイアウト */}
                <Flex visibleFrom="sm" align="center" gap="md">
                  <Avatar
                    src={user.imagePath} size={52} radius="xl" color={user.color}
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => { setUploadingId(user.id); fileInputRef.current?.click(); }}
                  >
                    {user.name[0]}
                  </Avatar>
                  <Text flex={1} fw={500} size="lg">{user.name}</Text>
                  <Group gap="xs">
                    <Badge variant="light" color="blue">{user.totalPlayCount}試合</Badge>
                    <Badge variant="light" color="gray">{user.totalRestCount}休</Badge>
                    <Badge variant="light"
                      color={user.gender === 'male' ? 'blue' : user.gender === 'female' ? 'pink' : 'gray'}
                    >
                      {user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : '性別未設定'}
                    </Badge>
                    <ActionIcon variant="light" onClick={() => openEditModal({ ...user, gender: user.gender ?? 'null' })}>
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon variant="light" color="red" onClick={() => setDeletingUser({ id: user.id, name: user.name })}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
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

      <Modal opened={shareOpened} onClose={handleShareClose} title="ユーザーを共有" centered size="sm">
        {qrUrl ? (
          <Stack align="center" gap="md">
            <Text size="sm" c="dimmed">このQRコードを別のデバイスで読み取ってください</Text>
            <QRCodeSVG value={qrUrl} size={240} />
            <Button variant="light" onClick={() => setQrUrl(null)}>← 選択に戻る</Button>
          </Stack>
        ) : (
          <Stack gap="sm">
            <Flex align="center" justify="space-between">
              <Text size="sm" c="dimmed">共有するユーザーを選択してください</Text>
              <Button
                size="xs" variant="subtle"
                onClick={() =>
                  selectedShareIds.size === users.length
                    ? setSelectedShareIds(new Set())
                    : setSelectedShareIds(new Set(users.map((u) => u.id)))
                }
              >
                {selectedShareIds.size === users.length ? '全解除' : '全選択'}
              </Button>
            </Flex>
            {users.map((user) => (
              <Card
                key={user.id} withBorder radius="md" padding="sm"
                onClick={() => toggleShareUser(user.id)}
                style={{ cursor: 'pointer', borderColor: selectedShareIds.has(user.id) ? 'var(--mantine-color-blue-5)' : undefined, borderWidth: selectedShareIds.has(user.id) ? 2 : 1 }}
              >
                <Flex align="center" gap="sm">
                  <Avatar src={user.imagePath} size={36} radius="xl" color={user.color}>{user.name[0]}</Avatar>
                  <Text flex={1} fw={500}>{user.name}</Text>
                  <Checkbox checked={selectedShareIds.has(user.id)} readOnly size="sm" />
                </Flex>
              </Card>
            ))}
            <Button disabled={selectedShareIds.size === 0} onClick={generateQr} mt="xs">
              QRコードを生成
            </Button>
          </Stack>
        )}
      </Modal>

      <Drawer opened={menuOpened} onClose={closeMenu} position="right" size="xs" title="メニュー">
        <Stack gap="sm">
          <Button fullWidth variant="light" onClick={() => { openScanner(); closeMenu(); }}>インポート</Button>
          <Button fullWidth variant="light" onClick={() => { openShare(); closeMenu(); }}>共有</Button>
          <Button fullWidth color="orange" variant="light" onClick={() => { openResetTeamBattle(); closeMenu(); }}>団体戦統計リセット</Button>
          <Button fullWidth color="red" variant="light" onClick={() => { openReset(); closeMenu(); }}>統計リセット</Button>
        </Stack>
      </Drawer>

      <Modal opened={scanOpened} onClose={handleScanClose} title="QRコードをスキャン" centered size="sm">
        {scanError ? (
          <Stack align="center" gap="md">
            <Text c="red">{scanError}</Text>
            <Button variant="light" onClick={handleScanClose}>閉じる</Button>
          </Stack>
        ) : importUsers.length > 0 ? (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">以下のユーザーを追加しますか？</Text>
            {importUsers.map((u, i) => (
              <Card key={i} withBorder radius="md" padding="sm">
                <Flex align="center" gap="sm">
                  <Avatar size={36} radius="xl" color={u.color}>{u.name[0]}</Avatar>
                  <Text fw={500}>{u.name}</Text>
                </Flex>
              </Card>
            ))}
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={handleScanClose}>キャンセル</Button>
              <Button onClick={handleImport}>追加する</Button>
            </Group>
          </Stack>
        ) : (
          <Stack align="center" gap="sm">
            <Text size="sm" c="dimmed">QRコードにカメラを向けてください</Text>
            <div style={{ position: 'relative', width: '100%', maxWidth: 320, aspectRatio: '1', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </Stack>
        )}
      </Modal>

      <Modal opened={!!editModalUser} onClose={() => setEditModalUser(null)} title="ユーザーを編集" centered size="sm">
        <Stack gap="md">
          <TextInput
            label="名前"
            value={editModalName}
            onChange={(e) => setEditModalName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
            autoFocus
          />
          <Stack gap="xs">
            <Text size="sm" fw={500}>性別</Text>
            <SegmentedControl
              value={editModalGender}
              onChange={setEditModalGender}
              data={[
                { label: '未設定', value: 'null' },
                { label: '男性', value: 'male' },
                { label: '女性', value: 'female' },
              ]}
            />
          </Stack>
          <Stack gap="xs">
            <Text size="sm" fw={500}>カラー</Text>
            <SimpleGrid cols={6} spacing={8}>
              {USER_COLORS.map((c) => (
                <ColorSwatch
                  key={c}
                  color={`var(--mantine-color-${c}-5)`}
                  size={28}
                  style={{ cursor: 'pointer', outline: editModalColor === c ? '2px solid var(--mantine-color-dark-5)' : 'none', outlineOffset: 2 }}
                  onClick={() => setEditModalColor(c)}
                />
              ))}
            </SimpleGrid>
          </Stack>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditModalUser(null)}>キャンセル</Button>
            <Button onClick={handleEditSave}>保存</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={resetTeamBattleOpened} onClose={closeResetTeamBattle} title="団体戦統計リセット" centered>
        <Text>団体戦のペア・対戦履歴をリセットしますか？</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={closeResetTeamBattle}>キャンセル</Button>
          <Button color="orange" onClick={() => { resetTeamBattleStats(); closeResetTeamBattle(); }}>リセット</Button>
        </Group>
      </Modal>

      <Modal opened={!!deletingUser} onClose={() => setDeletingUser(null)} title="ユーザーを削除" centered>
        <Text>「{deletingUser?.name}」を削除しますか？</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={() => setDeletingUser(null)}>キャンセル</Button>
          <Button color="red" onClick={() => { deleteUser(deletingUser!.id); setDeletingUser(null); }}>削除</Button>
        </Group>
      </Modal>

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
