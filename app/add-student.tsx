import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { useData } from '../contexts/DataContext';
import { DayPicker, formatTrainingDays } from '../components/DayPicker';

export default function AddStudentScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeDueDay, setFeeDueDay] = useState('25');
  const [saving, setSaving] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Create batch modal
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchDays, setNewBatchDays] = useState<string[]>([]);
  const [newBatchTime, setNewBatchTime] = useState('');
  const [creatingBatch, setCreatingBatch] = useState(false);

  const { batches, batchLoading, addBatch, refetchStudents } = useData();

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to add a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const canSubmit = name.trim().length > 0 && phone.trim().length === 10 && selectedBatch !== '';

  const handleSave = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);

    const { data: student, error } = await supabase
      .from('students')
      .insert({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        batch_id: selectedBatch,
        join_date: new Date().toISOString().slice(0, 10),
        is_active: true,
      })
      .select()
      .single();

    if (error || !student) {
      setSaving(false);
      Alert.alert('Error', error?.message ?? 'Could not add student. Please try again.');
      return;
    }

    if (feeAmount && parseInt(feeAmount, 10) > 0) {
      await supabase.from('fee_plans').upsert(
        {
          student_id: student.id,
          amount: parseInt(feeAmount, 10),
          frequency: 'monthly',
          due_day: parseInt(feeDueDay, 10) || 25,
        },
        { onConflict: 'student_id' }
      );
    }

    setSaving(false);
    refetchStudents();
    Alert.alert('Student Added!', `${name} has been added to the academy.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const handleCreateBatch = async () => {
    if (!newBatchName.trim()) {
      Alert.alert('Batch name required');
      return;
    }
    setCreatingBatch(true);
    const { data: newBatch, error } = await addBatch({
      name: newBatchName.trim(),
      schedule: '',
      time: newBatchTime.trim() || '',
      training_days: newBatchDays,
    });
    setCreatingBatch(false);
    if (error || !newBatch) {
      Alert.alert('Error', error?.message ?? 'Could not create batch. Please try again.');
      return;
    }
    setSelectedBatch(newBatch.id);
    setShowCreateBatch(false);
    setNewBatchName('');
    setNewBatchDays([]);
    setNewBatchTime('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Add Student</Text>
          <TouchableOpacity
            style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSubmit || saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="white" />
              : <Text style={styles.saveBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.avatarArea} onPress={handlePickPhoto}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={36} color={Colors.primary} />
                )}
              </View>
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={13} color="white" />
              </View>
            </View>
            <Text style={styles.avatarHint}>{photoUri ? 'Tap to change photo' : 'Add photo (optional)'}</Text>
          </TouchableOpacity>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Basic Info</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Rahul Kumar"
                placeholderTextColor={Colors.textLight}
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile number"
                placeholderTextColor={Colors.textLight}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Email (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="student@email.com"
                placeholderTextColor={Colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Batch */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Batch *</Text>
              <TouchableOpacity style={styles.createBatchBtn} onPress={() => setShowCreateBatch(true)}>
                <Ionicons name="add" size={14} color={Colors.primary} />
                <Text style={styles.createBatchText}>Create New Batch</Text>
              </TouchableOpacity>
            </View>

            {batchLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ margin: 12 }} />
            ) : batches.length === 0 ? (
              <TouchableOpacity style={styles.noBatchBtn} onPress={() => setShowCreateBatch(true)}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.noBatchText}>No batches yet — tap to create one</Text>
              </TouchableOpacity>
            ) : (
              batches.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.batchOption, selectedBatch === b.id && styles.batchOptionActive]}
                  onPress={() => setSelectedBatch(b.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.batchName, selectedBatch === b.id && styles.batchNameActive]}>
                      {b.name}
                    </Text>
                    {(b.training_days?.length > 0 || b.time) ? (
                      <Text style={styles.batchTime}>
                        {[b.training_days?.length > 0 ? formatTrainingDays(b.training_days) : null, b.time].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  {selectedBatch === b.id && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Fee Plan */}
          <View style={[styles.section, { marginBottom: 32 }]}>
            <Text style={styles.sectionLabel}>Fee Plan</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Monthly Fee (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 1500"
                placeholderTextColor={Colors.textLight}
                value={feeAmount}
                onChangeText={setFeeAmount}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Due Date (day of month)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 25"
                placeholderTextColor={Colors.textLight}
                value={feeDueDay}
                onChangeText={setFeeDueDay}
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Create Batch Modal */}
      <Modal visible={showCreateBatch} transparent animationType="slide" onRequestClose={() => setShowCreateBatch(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCreateBatch(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Create New Batch</Text>

              <View style={styles.modalField}>
                <Text style={styles.label}>Batch Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. U-14 Morning"
                  placeholderTextColor={Colors.textLight}
                  value={newBatchName}
                  onChangeText={setNewBatchName}
                  autoFocus
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.label}>Training Days</Text>
                <DayPicker selected={newBatchDays} onChange={setNewBatchDays} />
                {newBatchDays.length > 0 && (
                  <Text style={{ fontSize: 12, color: Colors.primary, marginTop: 6, fontWeight: '600' }}>
                    {formatTrainingDays(newBatchDays)}
                  </Text>
                )}
              </View>

              <View style={styles.modalField}>
                <Text style={styles.label}>Time (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 4:00 PM"
                  placeholderTextColor={Colors.textLight}
                  value={newBatchTime}
                  onChangeText={setNewBatchTime}
                />
              </View>

              <TouchableOpacity
                style={[styles.modalSaveBtn, !newBatchName.trim() && styles.saveBtnDisabled]}
                onPress={handleCreateBatch}
                disabled={!newBatchName.trim() || creatingBatch}
              >
                {creatingBatch
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.modalSaveBtnText}>Create Batch</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  closeBtn: { padding: 4 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.text },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 7, minWidth: 56, alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  scroll: { flex: 1 },
  avatarArea: { alignItems: 'center', paddingVertical: 24 },
  avatarWrapper: { position: 'relative', width: 80, height: 80, marginBottom: 8 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary, borderStyle: 'dashed',
    overflow: 'hidden',
  },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },
  avatarHint: { fontSize: 13, color: Colors.textSecondary },
  section: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16, marginBottom: 14, borderRadius: 12, padding: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  createBatchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primarySurface, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  createBatchText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    backgroundColor: Colors.background, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 15, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },
  noBatchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.primary,
    borderStyle: 'dashed', backgroundColor: Colors.primarySurface,
  },
  noBatchText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  batchOption: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 8,
  },
  batchOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  batchName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  batchNameActive: { color: Colors.primary },
  batchTime: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  modalField: { marginBottom: 14 },
  modalSaveBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  modalSaveBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
});
