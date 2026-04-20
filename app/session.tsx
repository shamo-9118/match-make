import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, FlatList, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSessionStore } from '../src/store/sessionStore';
import { useUserStore } from '../src/store/userStore';
import { generateRound, applyRoundToUsers, initLateJoiner } from '../src/utils/algorithm';
import { Court, Round, User } from '../src/types';

export default function SessionScreen() {
  const session = useSessionStore((s) => s.session);
  const { confirmNextRound, setNextRound, goBack, goToLatest, updateParticipants, endSession } = useSessionStore();
  const { users, updateUserStats } = useUserStore();
  const [showParticipants, setShowParticipants] = useState(false);

  const isViewing = session
    ? session.currentRoundIndex < session.latestRoundIndex
    : false;

  const currentRound: Round | null = session
    ? session.rounds[session.currentRoundIndex] ?? null
    : null;

  const scheduleNextRound = (afterRound: Round, updatedUsers: User[]) => {
    const participants = updatedUsers.filter((u) =>
      session!.participantIds.includes(u.id)
    );
    setTimeout(() => {
      const next = generateRound(
        participants,
        session!.courtCount,
        session!.gameFormat,
        afterRound.restingPlayerIds,
        afterRound.index + 1,
      );
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
    scheduleNextRound(session.nextRound, updatedUsers);
  };

  const toggleParticipant = async (userId: string) => {
    if (!session) return;
    const isIn = session.participantIds.includes(userId);

    if (isIn) {
      updateParticipants(session.participantIds.filter((id) => id !== userId));
    } else {
      const participants = users.filter((u) => session.participantIds.includes(u.id));
      const user = users.find((u) => u.id === userId)!;
      const initialized = initLateJoiner(user, participants);
      await updateUserStats([initialized]);
      updateParticipants([...session.participantIds, userId]);
    }

    if (session.rounds.length > 0) {
      scheduleNextRound(session.rounds[session.latestRoundIndex], users);
    }
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text>セッションがありません</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: '#3498db' }}>戻る</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalRounds = session.rounds.length;
  const displayIndex = session.currentRoundIndex;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          Alert.alert('セッション終了', 'セッションを終了しますか？', [
            { text: 'キャンセル', style: 'cancel' },
            { text: '終了', style: 'destructive', onPress: () => { endSession(); router.back(); } },
          ]);
        }}>
          <Text style={styles.backText}>← 終了</Text>
        </TouchableOpacity>

        <Text style={styles.roundIndicator}>
          {totalRounds > 0 ? `ラウンド ${displayIndex + 1} / ${totalRounds}` : '開始前'}
        </Text>

        <TouchableOpacity onPress={() => setShowParticipants(true)}>
          <Text style={styles.manageText}>参加者管理</Text>
        </TouchableOpacity>
      </View>

      {/* 過去閲覧中バナー */}
      {isViewing && (
        <View style={styles.viewingBanner}>
          <Text style={styles.viewingText}>過去のラウンドを閲覧中</Text>
          <TouchableOpacity onPress={goToLatest}>
            <Text style={styles.latestBtn}>最新に戻る</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={[styles.body, isViewing && styles.bodyDimmed]}>
        {currentRound ? (
          <>
            {currentRound.courts.map((court) => (
              <CourtCard key={court.courtNumber} court={court} users={users} />
            ))}

            {currentRound.restingPlayerIds.length > 0 && (
              <View style={styles.restCard}>
                <Text style={styles.restTitle}>休憩</Text>
                <View style={styles.restNames}>
                  {currentRound.restingPlayerIds.map((id) => {
                    const u = users.find((u) => u.id === id);
                    return (
                      <View key={id} style={styles.restChip}>
                        {u?.imagePath ? (
                          <Image source={{ uri: u.imagePath }} style={styles.restAvatar} />
                        ) : (
                          <View style={[styles.restAvatar, styles.restAvatarPlaceholder]}>
                            <Text style={styles.restAvatarText}>{u?.name[0] ?? '?'}</Text>
                          </View>
                        )}
                        <Text style={styles.restChipText}>{u?.name ?? id}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyText}>「次へ」を押してゲームを開始</Text>
          </View>
        )}
      </ScrollView>

      {/* フッターボタン */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.footerBtn, styles.backBtn, session.currentRoundIndex <= 0 && styles.disabled]}
          onPress={goBack}
          disabled={session.currentRoundIndex <= 0}
        >
          <Text style={[styles.footerBtnText, { color: '#555' }]}>← 戻る</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.footerBtn, styles.nextBtn]} onPress={handleNext}>
          <Text style={styles.footerBtnText}>
            {isViewing ? '最新へジャンプ →' : '次へ →'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 参加者管理モーダル */}
      <Modal visible={showParticipants} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>参加者管理</Text>
            <TouchableOpacity onPress={() => setShowParticipants(false)}>
              <Text style={{ color: '#3498db', fontSize: 16 }}>閉じる</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={users}
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => {
              const isIn = session.participantIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={[styles.modalUserRow, isIn && styles.modalUserRowIn]}
                  onPress={() => toggleParticipant(item.id)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {item.imagePath ? (
                      <Image source={{ uri: item.imagePath }} style={styles.modalAvatar} />
                    ) : (
                      <View style={[styles.modalAvatar, styles.modalAvatarPlaceholder]}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>{item.name[0]}</Text>
                      </View>
                    )}
                    <Text style={styles.modalUserName}>{item.name}</Text>
                  </View>
                  <Text style={[styles.modalUserStatus, isIn && { color: '#3498db' }]}>
                    {isIn ? '参加中 ✓' : '不参加'}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function CourtCard({ court, users }: { court: Court; users: User[] }) {
  const getUser = (id: string) => users.find((u) => u.id === id);

  const PlayerChip = ({ id }: { id: string }) => {
    const u = getUser(id);
    return (
      <View style={courtStyles.playerChip}>
        {u?.imagePath ? (
          <Image source={{ uri: u.imagePath }} style={courtStyles.playerAvatar} />
        ) : (
          <View style={[courtStyles.playerAvatar, courtStyles.playerAvatarPlaceholder]}>
            <Text style={courtStyles.playerAvatarText}>{u?.name[0] ?? '?'}</Text>
          </View>
        )}
        <Text style={courtStyles.playerName}>{u?.name ?? id}</Text>
      </View>
    );
  };

  return (
    <View style={courtStyles.card}>
      {/* コートタイトル */}
      <View style={courtStyles.titleRow}>
        <Text style={courtStyles.courtTitle}>コート {court.courtNumber}</Text>
      </View>

      {/* コートフィールド */}
      <View style={courtStyles.field}>
        {/* チームA側 */}
        <View style={courtStyles.side}>
          <Text style={courtStyles.teamLabel}>チーム A</Text>
          <View style={courtStyles.players}>
            {court.teamA.map((id) => <PlayerChip key={id} id={id} />)}
          </View>
        </View>

        {/* ネット */}
        <View style={courtStyles.netArea}>
          <View style={courtStyles.net} />
          <Text style={courtStyles.vsText}>VS</Text>
          <View style={courtStyles.net} />
        </View>

        {/* チームB側 */}
        <View style={courtStyles.side}>
          <Text style={courtStyles.teamLabel}>チーム B</Text>
          <View style={courtStyles.players}>
            {court.teamB.map((id) => <PlayerChip key={id} id={id} />)}
          </View>
        </View>
      </View>
    </View>
  );
}

const COURT_GREEN = '#2d7a3a';

const courtStyles = StyleSheet.create({
  card: {
    borderRadius: 20, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
    overflow: 'hidden',
  },
  titleRow: {
    backgroundColor: '#1a5c28', paddingVertical: 10, paddingHorizontal: 20,
  },
  courtTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  field: {
    backgroundColor: COURT_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderWidth: 3,
    borderColor: '#fff',
    borderTopWidth: 0,
  },
  side: { flex: 1, alignItems: 'center', gap: 16 },
  teamLabel: { fontSize: 13, fontWeight: 'bold', color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
  players: { flexDirection: 'row', gap: 20, flexWrap: 'wrap', justifyContent: 'center' },
  playerChip: { alignItems: 'center', gap: 8 },
  playerAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#fff' },
  playerAvatarPlaceholder: { backgroundColor: '#1a5c28', justifyContent: 'center', alignItems: 'center' },
  playerAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 24 },
  playerName: { fontSize: 13, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  netArea: { alignItems: 'center', gap: 6, marginHorizontal: 8 },
  net: { width: 4, height: 40, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 2 },
  vsText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee',
  },
  backText: { color: '#e74c3c', fontSize: 16, fontWeight: 'bold' },
  roundIndicator: { fontSize: 16, fontWeight: 'bold' },
  manageText: { color: '#3498db', fontSize: 16, fontWeight: 'bold' },
  viewingBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f39c12', paddingVertical: 10, paddingHorizontal: 16,
  },
  viewingText: { color: '#fff', fontWeight: 'bold' },
  latestBtn: { color: '#fff', textDecorationLine: 'underline', fontWeight: 'bold' },
  body: { flex: 1, padding: 16 },
  bodyDimmed: { opacity: 0.6 },
  restCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  restTitle: { fontSize: 16, fontWeight: 'bold', color: '#888', marginBottom: 12 },
  restNames: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  restChip: { alignItems: 'center', gap: 4 },
  restAvatar: { width: 44, height: 44, borderRadius: 22 },
  restAvatarPlaceholder: { backgroundColor: '#bdc3c7', justifyContent: 'center', alignItems: 'center' },
  restAvatarText: { color: '#fff', fontWeight: 'bold' },
  restChipText: { fontSize: 12, color: '#7f8c8d' },
  emptyText: { fontSize: 18, color: '#aaa', textAlign: 'center', marginTop: 60 },
  footer: {
    flexDirection: 'row', padding: 16, gap: 12,
    backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee',
  },
  footerBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  backBtn: { backgroundColor: '#ecf0f1' },
  nextBtn: { backgroundColor: '#3498db' },
  footerBtnText: { fontWeight: 'bold', fontSize: 16, color: '#fff' },
  disabled: { opacity: 0.4 },
  modal: { flex: 1, paddingHorizontal: 24 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16, marginTop: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalUserRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderRadius: 12, backgroundColor: '#f5f5f5', marginBottom: 8,
  },
  modalUserRowIn: { backgroundColor: '#ebf5fb', borderWidth: 2, borderColor: '#3498db' },
  modalAvatar: { width: 36, height: 36, borderRadius: 18 },
  modalAvatarPlaceholder: { backgroundColor: '#3498db', justifyContent: 'center', alignItems: 'center' },
  modalUserName: { fontSize: 16 },
  modalUserStatus: { color: '#888' },
});
