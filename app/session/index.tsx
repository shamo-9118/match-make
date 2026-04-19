import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useSessionStore } from '../../src/store/sessionStore';
import { useUserStore } from '../../src/store/userStore';
import { generateRound, applyRoundToUsers, initLateJoiner } from '../../src/utils/algorithm';
import { Court, Round, User } from '../../src/types';

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

  // バックグラウンドで次のラウンドを計算
  const scheduleNextRound = (afterRound: Round, updatedUsers: User[]) => {
    const participants = updatedUsers.filter((u) =>
      session!.participantIds.includes(u.id)
    );
    const prevRestingIds = afterRound.restingPlayerIds;
    setTimeout(() => {
      const next = generateRound(
        participants,
        session!.courtCount,
        session!.gameFormat,
        prevRestingIds,
        afterRound.index + 1,
      );
      setNextRound(next);
    }, 0);
  };

  // 「次へ」押下
  const handleNext = () => {
    if (!session) return;

    if (isViewing) {
      // 過去閲覧中 → 最新へジャンプしてから次へ進む
      goToLatest();
      return;
    }

    if (!session.nextRound) return;

    // 1. カウント更新
    const updatedUsers = applyRoundToUsers(session.nextRound, users);
    updateUserStats(updatedUsers);

    // 2. 次ラウンドを確定表示
    confirmNextRound();

    // 3. 次の次ラウンドをバックグラウンド計算
    scheduleNextRound(session.nextRound, updatedUsers);
  };

  // 参加者管理: ユーザー追加/削除
  const toggleParticipant = async (userId: string) => {
    if (!session) return;
    const isIn = session.participantIds.includes(userId);

    if (isIn) {
      // 離脱
      const newIds = session.participantIds.filter((id) => id !== userId);
      updateParticipants(newIds);
    } else {
      // 途中参加: カウントを平均で初期化
      const participants = users.filter((u) => session.participantIds.includes(u.id));
      const user = users.find((u) => u.id === userId)!;
      const initialized = initLateJoiner(user, participants);
      await updateUserStats([initialized]);
      updateParticipants([...session.participantIds, userId]);
    }

    // 参加者変更後に次ラウンドを再計算
    if (session.rounds.length > 0) {
      const latest = session.rounds[session.latestRoundIndex];
      scheduleNextRound(latest, users);
    }
  };

  if (!session) {
    return (
      <View style={styles.center}>
        <Text>セッションがありません</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#3498db' }}>戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const participantUsers = users.filter((u) => session.participantIds.includes(u.id));
  const totalRounds = session.rounds.length;
  const displayIndex = session.currentRoundIndex;

  return (
    <View style={styles.container}>
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
            {/* コート表示 */}
            {currentRound.courts.map((court) => (
              <CourtCard
                key={court.courtNumber}
                court={court}
                users={users}
                gameFormat={session.gameFormat}
              />
            ))}

            {/* 休憩者 */}
            {currentRound.restingPlayerIds.length > 0 && (
              <View style={styles.restCard}>
                <Text style={styles.restTitle}>休憩</Text>
                <View style={styles.restNames}>
                  {currentRound.restingPlayerIds.map((id) => {
                    const u = users.find((u) => u.id === id);
                    return (
                      <View key={id} style={styles.restChip}>
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
          <Text style={styles.footerBtnText}>← 戻る</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.footerBtn, styles.nextBtn]} onPress={handleNext}>
          <Text style={styles.footerBtnText}>
            {isViewing ? '最新へジャンプ →' : '次へ →'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 参加者管理モーダル */}
      <Modal visible={showParticipants} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
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
                  <Text style={styles.modalUserName}>{item.name}</Text>
                  <Text style={styles.modalUserStatus}>{isIn ? '参加中 ✓' : '不参加'}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

function CourtCard({ court, users, gameFormat }: { court: Court; users: User[]; gameFormat: string }) {
  const getName = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  return (
    <View style={styles.courtCard}>
      <Text style={styles.courtTitle}>コート {court.courtNumber}</Text>
      <View style={styles.teamsRow}>
        <View style={styles.team}>
          <Text style={styles.teamLabel}>チームA</Text>
          {court.teamA.map((id) => (
            <Text key={id} style={styles.playerName}>{getName(id)}</Text>
          ))}
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.team}>
          <Text style={styles.teamLabel}>チームB</Text>
          {court.teamB.map((id) => (
            <Text key={id} style={styles.playerName}>{getName(id)}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee',
  },
  backText: { color: '#e74c3c', fontSize: 16, fontWeight: 'bold' },
  roundIndicator: { fontSize: 16, fontWeight: 'bold' },
  manageText: { color: '#3498db', fontSize: 16, fontWeight: 'bold' },
  viewingBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f39c12', padding: 10, paddingHorizontal: 16,
  },
  viewingText: { color: '#fff', fontWeight: 'bold' },
  latestBtn: { color: '#fff', textDecorationLine: 'underline', fontWeight: 'bold' },
  body: { flex: 1, padding: 16 },
  bodyDimmed: { opacity: 0.6 },
  courtCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  courtTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#2c3e50' },
  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  team: { alignItems: 'center', flex: 1 },
  teamLabel: { fontSize: 12, color: '#888', marginBottom: 8 },
  playerName: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  vs: { fontSize: 20, fontWeight: 'bold', color: '#e74c3c', marginHorizontal: 8 },
  restCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
  },
  restTitle: { fontSize: 16, fontWeight: 'bold', color: '#888', marginBottom: 8 },
  restNames: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  restChip: { backgroundColor: '#ecf0f1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  restChipText: { color: '#7f8c8d' },
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
  modal: { flex: 1, padding: 24 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalUserRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: 14, borderRadius: 12, backgroundColor: '#f5f5f5', marginBottom: 8,
  },
  modalUserRowIn: { backgroundColor: '#ebf5fb', borderWidth: 2, borderColor: '#3498db' },
  modalUserName: { fontSize: 16 },
  modalUserStatus: { color: '#888' },
});
