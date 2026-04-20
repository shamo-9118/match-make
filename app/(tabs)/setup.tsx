import { useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useUserStore } from '../../src/store/userStore';
import { useSessionStore } from '../../src/store/sessionStore';
import { GameFormat } from '../../src/types';
import { generateRound } from '../../src/utils/algorithm';

export default function SetupScreen() {
  const { users } = useUserStore();
  const { startSession, setNextRound } = useSessionStore();

  const [courtCount, setCourtCount] = useState(2);
  const [gameFormat, setGameFormat] = useState<GameFormat>('doubles');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sortedUsers = [...users].sort((a, b) => b.totalPlayCount - a.totalPlayCount);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const playersPerCourt = gameFormat === 'doubles' ? 4 : 2;
  const minRequired = courtCount * playersPerCourt;
  const canStart = selectedIds.size >= minRequired;

  const handleStart = () => {
    const participantIds = [...selectedIds];
    startSession(courtCount, gameFormat, participantIds);
    const participants = users.filter((u) => participantIds.includes(u.id));
    const firstRound = generateRound(participants, courtCount, gameFormat, [], 0);
    setNextRound(firstRound);
    router.push('/session');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>セッション設定</Text>

        <Text style={styles.label}>コート数</Text>
        <View style={styles.row}>
          {[1, 2, 3, 4].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.chip, courtCount === n && styles.chipSelected]}
              onPress={() => setCourtCount(n)}
            >
              <Text style={[styles.chipText, courtCount === n && styles.chipTextSelected]}>
                {n}コート
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>ゲーム形式</Text>
        <View style={styles.row}>
          {(['doubles', 'singles'] as GameFormat[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, gameFormat === f && styles.chipSelected]}
              onPress={() => setGameFormat(f)}
            >
              <Text style={[styles.chipText, gameFormat === f && styles.chipTextSelected]}>
                {f === 'doubles' ? 'ダブルス (2vs2)' : 'シングルス (1vs1)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>
          参加者選択　{selectedIds.size}人選択中
          {!canStart && <Text style={styles.warn}> （最低{minRequired}人必要）</Text>}
        </Text>
        <FlatList
          data={sortedUsers}
          keyExtractor={(u) => u.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.userRow, selectedIds.has(item.id) && styles.userRowSelected]}
              onPress={() => toggleUser(item.id)}
            >
              <View style={styles.userInfo}>
                {item.imagePath ? (
                  <Image source={{ uri: item.imagePath }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{item.name[0]}</Text>
                  </View>
                )}
                <Text style={styles.userName}>{item.name}</Text>
              </View>
              {selectedIds.has(item.id) && <Text style={styles.check}>✓</Text>}
            </TouchableOpacity>
          )}
        />

        <TouchableOpacity
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={!canStart}
        >
          <Text style={styles.startBtnText}>セッション開始</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  warn: { color: '#e74c3c', fontWeight: 'normal' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#3498db', borderColor: '#3498db' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff', fontWeight: 'bold' },
  userRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 8,
  },
  userRowSelected: { backgroundColor: '#ebf5fb', borderWidth: 2, borderColor: '#3498db' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { backgroundColor: '#3498db', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  userName: { fontSize: 15 },
  check: { color: '#3498db', fontWeight: 'bold', fontSize: 18 },
  startBtn: {
    marginTop: 32, backgroundColor: '#2ecc71',
    padding: 16, borderRadius: 12, alignItems: 'center',
  },
  startBtnDisabled: { backgroundColor: '#bdc3c7' },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
