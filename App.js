import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

export default function App() {
  const [entries, setEntries] = useState({});
  const [mainGoal, setMainGoal] = useState('NOMEIE SEU OBJETIVO');
  const [obstacleToday, setObstacleToday] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  const getTodayKey = () => new Date().toISOString().split('T')[0];

  const loadAllData = useCallback(async () => {
    try {
      const today = getTodayKey();
      const [sEntries, sGoal, sTheme, sObs] = await Promise.all([
        AsyncStorage.getItem('axis_entries'),
        AsyncStorage.getItem('axis_goal'),
        AsyncStorage.getItem('axis_theme'),
        AsyncStorage.getItem(`obs_${today}`),
      ]);

      if (sEntries) setEntries(JSON.parse(sEntries));
      if (sGoal) setMainGoal(sGoal);
      if (sTheme !== null) setIsDarkMode(JSON.parse(sTheme));
      if (sObs) setObstacleToday(sObs);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao carregar dados.');
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const registerEntry = async (type) => {
    const today = getTodayKey();
    const newEntries = {
      ...entries,
      [today]: { type, obstacle: obstacleToday },
    };
    setEntries(newEntries);
    await AsyncStorage.setItem('axis_entries', JSON.stringify(newEntries));
    Alert.alert('AXIS', 'Progresso consolidado.');
  };

  const saveObstacle = async (text) => {
    setObstacleToday(text);
    await AsyncStorage.setItem(`obs_${getTodayKey()}`, text);
  };

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    await AsyncStorage.setItem('axis_theme', JSON.stringify(newTheme));
  };

  const exportData = async () => {
    try {
      const data = JSON.stringify({ entries, mainGoal, isDarkMode }, null, 2);
      const fileName = `Axis-Backup-${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, data);

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (permissions.granted) {
          const base64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: 'base64',
          });

          await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'application/json'
          )
            .then(async (uri) => {
              await FileSystem.writeAsStringAsync(uri, base64, {
                encoding: 'base64',
              });
              Alert.alert('Sucesso', `Arquivo salvo:\n${fileName}`);
            })
            .catch((e) => {
              Alert.alert('Erro', 'Falha ao salvar no local escolhido.');
            });
        }
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Salvar backup do AXIS',
            UTI: 'public.json',
          });
        } else {
          Alert.alert('Erro', 'Compartilhamento não disponível.');
        }
      }
    } catch (e) {
      Alert.alert('Erro', 'Falha ao exportar dados: ' + e.message);
    }
  };

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);

      const data = JSON.parse(fileContent);

      if (data.entries) {
        setEntries(data.entries);
        setMainGoal(data.mainGoal || 'NOMEIE SEU OBJETIVO');
        if (data.isDarkMode !== undefined) {
          setIsDarkMode(data.isDarkMode);
        }

        await AsyncStorage.setItem('axis_entries', JSON.stringify(data.entries));
        await AsyncStorage.setItem('axis_goal', data.mainGoal || 'NOMEIE SEU OBJETIVO');
        await AsyncStorage.setItem('axis_theme', JSON.stringify(data.isDarkMode ?? true));

        Alert.alert('Sucesso', 'Backup restaurado com sucesso!');
      } else {
        Alert.alert('Erro', 'Arquivo de backup inválido.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Falha ao importar: ' + e.message);
    }
  };

  const generateGrid = () => {
    const days = [];
    for (let i = 48; i >= 0; i--) {
      days.push(
        new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
      );
    }
    return days;
  };

  const theme = {
    bg: isDarkMode ? '#000' : '#FFF',
    text: isDarkMode ? '#FFF' : '#000',
    card: isDarkMode ? '#111' : '#F2F2F2',
    border: isDarkMode ? '#222' : '#DDD',
    sub: isDarkMode ? '#666' : '#999',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.brand, { color: theme.text }]}>AXIS</Text>
          <TouchableOpacity
            onPress={() => setIsEditingGoal(true)}
            style={styles.goalBox}>
            <Text style={[styles.goalLabel, { color: theme.sub }]}>
              OBJETIVO ATUAL
            </Text>
            <Text style={[styles.goalText, { color: theme.text }]}>
              {mainGoal.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.centerGridContainer}>
          <View style={styles.gridWrap}>
            {generateGrid().map((day) => (
              <View
                key={day}
                style={[
                  styles.cell,
                  {
                    backgroundColor:
                      entries[day]?.type === 'ideal'
                        ? theme.text
                        : entries[day]?.type === 'minimal'
                          ? theme.sub
                          : 'transparent',
                    borderColor: theme.border,
                    borderWidth: 1,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={[styles.obsCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.obsTitle, { color: theme.text }]}>
            O QUE TE IMPEDIU HOJE?
          </Text>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Descreva o atrito..."
            placeholderTextColor={theme.sub}
            value={obstacleToday}
            onChangeText={saveObstacle}
            multiline
          />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => setShowHistory(true)}
            style={styles.utilBtn}>
            <Ionicons name="list" size={20} color={theme.text} />
            <Text style={[styles.utilText, { color: theme.sub }]}>LOGS</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme} style={styles.utilBtn}>
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={20}
              color={theme.text}
            />
            <Text style={[styles.utilText, { color: theme.sub }]}>TEMA</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={exportData} style={styles.utilBtn}>
            <Ionicons name="share-outline" size={20} color={theme.text} />
            <Text style={[styles.utilText, { color: theme.sub }]}>
              EXPORTAR
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={importData} style={styles.utilBtn}>
            <Ionicons name="download-outline" size={20} color={theme.text} />
            <Text style={[styles.utilText, { color: theme.sub }]}>
              IMPORTAR
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: theme.bg, borderTopColor: theme.border },
        ]}>
        <TouchableOpacity
          style={[styles.mainBtn, { backgroundColor: theme.text }]}
          onPress={() => registerEntry('ideal')}>
          <Text style={[styles.btnLabel, { color: theme.bg }]}>FIZ TUDO</Text>
          <Text style={[styles.btnSubLabel, { color: theme.bg }]}>
            META COMPLETA
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mainBtn,
            {
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
            },
          ]}
          onPress={() => registerEntry('minimal')}>
          <Text style={[styles.btnLabel, { color: theme.text }]}>
            SÓ O MÍNIMO
          </Text>
          <Text style={[styles.btnSubLabel, { color: theme.sub }]}>
            MANTER FLUXO
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showHistory} animationType="slide">
        <SafeAreaView
          style={[
            styles.container,
            { backgroundColor: theme.bg, padding: 25 },
          ]}>
          <TouchableOpacity
            onPress={() => setShowHistory(false)}
            style={{ alignSelf: 'flex-end', padding: 10 }}>
            <Ionicons name="close" size={30} color={theme.text} />
          </TouchableOpacity>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text
              style={[
                styles.brand,
                { color: theme.text, textAlign: 'center', marginBottom: 30 },
              ]}>
              HISTÓRICO
            </Text>
            {Object.keys(entries)
              .reverse()
              .map((day) => (
                <View
                  key={day}
                  style={[
                    styles.historyItem,
                    { borderBottomColor: theme.border },
                  ]}>
                  <Text style={[styles.historyDate, { color: theme.sub }]}>
                    {day}
                  </Text>
                  <Text style={[styles.historyStatus, { color: theme.text }]}>
                    {entries[day].type === 'ideal'
                      ? 'PERFORMANCE COMPLETA'
                      : 'NÍVEL MÍNIMO'}
                  </Text>
                  {entries[day].obstacle ? (
                    <Text style={[styles.historyObs, { color: theme.sub }]}>
                      ATRITO: {entries[day].obstacle}
                    </Text>
                  ) : null}
                </View>
              ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={isEditingGoal} transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              QUAL O SEU EIXO CENTRAL?
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { color: theme.text, borderBottomColor: theme.text },
              ]}
              value={mainGoal}
              onChangeText={setMainGoal}
              autoFocus
            />
            <TouchableOpacity
              onPress={() => {
                AsyncStorage.setItem('axis_goal', mainGoal);
                setIsEditingGoal(false);
              }}
              style={[styles.saveBtn, { backgroundColor: theme.text }]}>
              <Text style={[styles.saveBtnText, { color: theme.bg }]}>
                CONFIRMAR
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingTop: 40, paddingHorizontal: 25, paddingBottom: 150 },
  header: { marginBottom: 40, alignItems: 'center' },
  brand: { fontSize: 24, fontWeight: '900', letterSpacing: 8 },
  goalBox: { marginTop: 15, alignItems: 'center' },
  goalLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  goalText: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 5,
    textAlign: 'center',
  },
  centerGridContainer: { alignItems: 'center', marginBottom: 50 },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: width * 0.7,
    gap: 8,
    justifyContent: 'center',
  },
  cell: { width: 14, height: 14 },
  obsCard: { padding: 25, marginBottom: 35 },
  obsTitle: { fontSize: 12, fontWeight: '900', marginBottom: 15 },
  input: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  utilBtn: { alignItems: 'center', flex: 1 },
  utilText: {
    fontSize: 8,
    fontWeight: '900',
    marginTop: 5,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 20,
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    paddingBottom: 40,
  },
  mainBtn: {
    flex: 1,
    height: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnLabel: { fontWeight: '900', fontSize: 14 },
  btnSubLabel: { fontSize: 9, fontWeight: '800', marginTop: 2 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    padding: 40,
  },
  modalContent: { padding: 30 },
  modalTitle: { fontWeight: '900', fontSize: 12, marginBottom: 20 },
  modalInput: {
    fontSize: 18,
    fontWeight: '900',
    borderBottomWidth: 2,
    paddingBottom: 10,
  },
  saveBtn: { marginTop: 30, padding: 15, alignItems: 'center' },
  saveBtnText: { fontWeight: '900', fontSize: 12 },
  historyItem: { paddingVertical: 20, borderBottomWidth: 1 },
  historyDate: { fontSize: 12, fontWeight: '900' },
  historyStatus: { fontSize: 16, fontWeight: '900', marginVertical: 5 },
  historyObs: { fontSize: 13, fontStyle: 'italic', marginTop: 5 },
});
