import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useUserStore } from '../../src/store/userStore';
import { User } from '../../src/types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function UsersScreen() {
  const { users, addUser, updateUser, deleteUser, resetAllStats } = useUserStore();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return;
    await addUser({ id: uuidv4(), name: name.trim() });
    setName('');
  };

  const handlePickImage = async (userId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) {
      await updateUser(userId, { imagePath: result.assets[0].uri });
    }
  };

  const handleDelete = (user: User) => {
    Alert.alert('削除', `${user.name} を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => deleteUser(user.id) },
    ]);
  };

  const handleResetStats = () => {
    Alert.alert(
      '練習終了',
      '参加回数・対戦履歴をリセットしますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '終了する', style: 'destructive', onPress: () => resetAllStats() },
      ]
    );
  };

  const handleEditSave = async (id: string) => {
    if (editName.trim()) await updateUser(id, { name: editName.trim() });
    setEditingId(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ユーザー管理</Text>
        <TouchableOpacity style={styles.resetBtn} onPress={handleResetStats}>
          <Text style={styles.resetBtnText}>練習終了</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="名前を入力"
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>追加</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <View style={styles.userRow}>
            <TouchableOpacity onPress={() => handlePickImage(item.id)}>
              {item.imagePath ? (
                <Image source={{ uri: item.imagePath }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>{item.name[0]}</Text>
                </View>
              )}
            </TouchableOpacity>

            {editingId === item.id ? (
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={editName}
                onChangeText={setEditName}
                onSubmitEditing={() => handleEditSave(item.id)}
                autoFocus
                returnKeyType="done"
              />
            ) : (
              <Text style={styles.userName}>{item.name}</Text>
            )}

            <Text style={styles.countText}>
              {item.totalPlayCount}試合 / {item.totalRestCount}休
            </Text>

            <TouchableOpacity
              onPress={() => {
                setEditingId(item.id);
                setEditName(item.name);
              }}
            >
              <Text style={styles.actionText}>編集</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item)}>
              <Text style={[styles.actionText, { color: '#e74c3c' }]}>削除</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold' },
  resetBtn: { backgroundColor: '#e74c3c', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  resetBtnText: { color: '#fff', fontWeight: 'bold' },
  addRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff',
  },
  addBtn: { backgroundColor: '#3498db', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: 'bold' },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 8,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { backgroundColor: '#3498db', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  userName: { flex: 1, fontSize: 16 },
  countText: { fontSize: 12, color: '#888' },
  actionText: { color: '#3498db', fontWeight: 'bold' },
});
