import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import {
  X,
  Calendar,
  Clock,
  Bell,
  CheckCircle2,
  Circle,
  FileEdit,
  Save,
  Flag
} from 'lucide-react-native';
import { COLORS, SPACING } from '../constants/theme';
import { TaskReminder } from '../services/droneSync';
import { CalendarClockModal } from './CalendarClockModal';

interface EditDeedModalProps {
  visible: boolean;
  task: TaskReminder | null;
  onClose: () => void;
  onSave: (updatedTask: {
    title: string;
    dueDate: string;
    dueTime: string;
    remindersEnabled: boolean;
    alertFrequencyMinutes: number;
    status: 'active' | 'completed';
    priority?: 'high' | 'medium' | 'low';
  }) => Promise<void>;
}

export const EditDeedModal: React.FC<EditDeedModalProps> = ({
  visible,
  task,
  onClose,
  onSave
}) => {
  if (!task) return null;

  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate || 'Today');
  const [dueTime, setDueTime] = useState(task.dueTime || '23:59');
  const [remindersEnabled, setRemindersEnabled] = useState(task.remindersEnabled !== false);
  const [alertFrequencyMinutes, setAlertFrequencyMinutes] = useState(
    task.alertFrequencyMinutes || 15
  );
  const [status, setStatus] = useState<'active' | 'completed'>(task.status);
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [saving, setSaving] = useState(false);

  // Sub-picker modal state (Calendar / Clock)
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTab, setPickerTab] = useState<'calendar' | 'clock'>('calendar');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDueDate(task.dueDate || 'Today');
      setDueTime(task.dueTime || '23:59');
      setRemindersEnabled(task.remindersEnabled !== false);
      setAlertFrequencyMinutes(task.alertFrequencyMinutes || 15);
      setStatus(task.status);
    }
  }, [task]);

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getTomorrowStr = () => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handlePickerConfirm = (chosenDate: Date) => {
    if (pickerTab === 'calendar') {
      const yr = chosenDate.getFullYear();
      const mo = String(chosenDate.getMonth() + 1).padStart(2, '0');
      const da = String(chosenDate.getDate()).padStart(2, '0');
      setDueDate(`${yr}-${mo}-${da}`);
    } else {
      const hr = String(chosenDate.getHours()).padStart(2, '0');
      const mi = String(chosenDate.getMinutes()).padStart(2, '0');
      setDueTime(`${hr}:${mi}`);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        dueDate,
        dueTime,
        remindersEnabled,
        alertFrequencyMinutes,
        status,
        priority,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isToday = dueDate === 'Today' || dueDate === getTodayStr();
  const isTomorrow = dueDate === 'Tomorrow' || dueDate === getTomorrowStr();
  const isCustomDate = !isToday && !isTomorrow;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <FileEdit size={18} color={COLORS.primaryAccent} />
              </View>
              <Text style={styles.headerTitle}>Modify Deed</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={20} color={COLORS.softText} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>DEED TITLE</Text>
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="What deed needs to be done?"
                placeholderTextColor={COLORS.mutedText}
                multiline
              />
            </View>

            {/* Status Toggle */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>STATUS</Text>
              <View style={styles.segmentedRow}>
                <TouchableOpacity
                  style={[
                    styles.segmentedTab,
                    status === 'active' && styles.segmentedTabActive,
                  ]}
                  onPress={() => setStatus('active')}
                >
                  <Circle size={15} color={status === 'active' ? '#FFFFFF' : COLORS.mutedText} style={{ marginRight: 6 }} />
                  <Text
                    style={[
                      styles.segmentedTabText,
                      status === 'active' && styles.segmentedTabTextActive,
                    ]}
                  >
                    Active
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentedTab,
                    status === 'completed' && styles.segmentedTabActiveSuccess,
                  ]}
                  onPress={() => setStatus('completed')}
                >
                  <CheckCircle2 size={15} color={status === 'completed' ? '#FFFFFF' : COLORS.mutedText} style={{ marginRight: 6 }} />
                  <Text
                    style={[
                      styles.segmentedTabText,
                      status === 'completed' && styles.segmentedTabTextActive,
                    ]}
                  >
                    Completed
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Due Date Presets */}
            <View style={styles.inputGroup}>
              <View style={styles.labelWithBadge}>
                <Text style={styles.fieldLabel}>SCHEDULED DAY</Text>
                <View style={styles.badgePill}>
                  <Calendar size={12} color={COLORS.primaryAccent} style={{ marginRight: 4 }} />
                  <Text style={styles.badgePillText}>{dueDate}</Text>
                </View>
              </View>

              <View style={styles.segmentedRow}>
                <TouchableOpacity
                  style={[
                    styles.segmentedTab,
                    isToday && styles.segmentedTabActive,
                  ]}
                  onPress={() => setDueDate('Today')}
                >
                  <Text
                    style={[
                      styles.segmentedTabText,
                      isToday && styles.segmentedTabTextActive,
                    ]}
                  >
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentedTab,
                    isTomorrow && styles.segmentedTabActive,
                  ]}
                  onPress={() => setDueDate('Tomorrow')}
                >
                  <Text
                    style={[
                      styles.segmentedTabText,
                      isTomorrow && styles.segmentedTabTextActive,
                    ]}
                  >
                    Tomorrow
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentedTab,
                    isCustomDate && styles.segmentedTabActive,
                  ]}
                  onPress={() => {
                    setPickerTab('calendar');
                    setPickerVisible(true);
                  }}
                >
                  <Text
                    style={[
                      styles.segmentedTabText,
                      isCustomDate && styles.segmentedTabTextActive,
                    ]}
                  >
                    {isCustomDate ? dueDate : 'Pick Date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Due Time */}
            <View style={styles.inputGroup}>
              <View style={styles.labelWithBadge}>
                <Text style={styles.fieldLabel}>SCHEDULED TIME</Text>
                <View style={styles.badgePill}>
                  <Clock size={12} color={COLORS.primaryAccent} style={{ marginRight: 4 }} />
                  <Text style={styles.badgePillText}>{dueTime}</Text>
                </View>
              </View>

              <View style={styles.timePillsWrap}>
                {['09:00', '12:00', '18:00', '23:59'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.timePill,
                      dueTime === t && styles.timePillActive,
                    ]}
                    onPress={() => setDueTime(t)}
                  >
                    <Text
                      style={[
                        styles.timePillText,
                        dueTime === t && styles.timePillTextActive,
                      ]}
                    >
                      {t === '23:59' ? 'End of Day (23:59)' : t}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[
                    styles.timePill,
                    !['09:00', '12:00', '18:00', '23:59'].includes(dueTime) && styles.timePillActive,
                  ]}
                  onPress={() => {
                    setPickerTab('clock');
                    setPickerVisible(true);
                  }}
                >
                  <Text
                    style={[
                      styles.timePillText,
                      !['09:00', '12:00', '18:00', '23:59'].includes(dueTime) && styles.timePillTextActive,
                    ]}
                  >
                    Custom Time...
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Reminder Alerts */}
            <View style={styles.inputGroup}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelGroup}>
                  <Bell size={16} color={COLORS.primaryAccent} style={{ marginRight: 8 }} />
                  <View>
                    <Text style={styles.toggleTitle}>Scout Reminder Alerts</Text>
                    <Text style={styles.toggleSubtitle}>Push notifications & local alarms</Text>
                  </View>
                </View>
                <Switch
                  value={remindersEnabled && status === 'active'}
                  disabled={status === 'completed'}
                  onValueChange={setRemindersEnabled}
                  trackColor={{ false: '#374151', true: COLORS.primaryAccent }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {remindersEnabled && status === 'active' && (
                <View style={styles.frequencyRow}>
                  <Text style={styles.freqLabel}>Alert Repeat Interval:</Text>
                  <View style={styles.freqPills}>
                    {[15, 30, 60].map((mins) => (
                      <TouchableOpacity
                        key={mins}
                        style={[
                          styles.freqBtn,
                          alertFrequencyMinutes === mins && styles.freqBtnActive,
                        ]}
                        onPress={() => setAlertFrequencyMinutes(mins)}
                      >
                        <Text
                          style={[
                            styles.freqBtnText,
                            alertFrequencyMinutes === mins && styles.freqBtnTextActive,
                          ]}
                        >
                          {mins}m
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!title.trim() || saving) && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={!title.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Save size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Date / Time Sub Modal */}
        <CalendarClockModal
          visible={pickerVisible}
          initialTab={pickerTab}
          onConfirm={handlePickerConfirm}
          onClose={() => setPickerVisible(false)}
          title={pickerTab === 'calendar' ? 'Select Due Date' : 'Select Due Time'}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#181A20',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#262A34',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(224, 80, 18, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F9FAFB',
    fontSize: 17,
    fontWeight: '700',
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#262A34',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  inputGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  labelWithBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(224, 80, 18, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(224, 80, 18, 0.25)',
  },
  badgePillText: {
    color: COLORS.primaryAccent,
    fontSize: 11,
    fontWeight: '600',
  },
  titleInput: {
    backgroundColor: '#22252E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    color: '#F9FAFB',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentedTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22252E',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingVertical: 10,
  },
  segmentedTabActive: {
    backgroundColor: COLORS.primaryAccent,
    borderColor: COLORS.primaryAccent,
  },
  segmentedTabActiveSuccess: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  segmentedTabText: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentedTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  timePillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timePill: {
    backgroundColor: '#22252E',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timePillActive: {
    backgroundColor: 'rgba(224, 80, 18, 0.2)',
    borderColor: COLORS.primaryAccent,
  },
  timePillText: {
    color: COLORS.softText,
    fontSize: 12,
    fontWeight: '600',
  },
  timePillTextActive: {
    color: COLORS.primaryAccent,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#22252E',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  toggleLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleTitle: {
    color: '#F9FAFB',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleSubtitle: {
    color: COLORS.mutedText,
    fontSize: 11,
    marginTop: 2,
  },
  frequencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    backgroundColor: '#1E2129',
    padding: 10,
    borderRadius: 10,
  },
  freqLabel: {
    color: COLORS.softText,
    fontSize: 12,
    fontWeight: '500',
  },
  freqPills: {
    flexDirection: 'row',
    gap: 6,
  },
  freqBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#2A2E39',
  },
  freqBtnActive: {
    backgroundColor: COLORS.primaryAccent,
  },
  freqBtnText: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '600',
  },
  freqBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#262A34',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#262A34',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: COLORS.primaryAccent,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
