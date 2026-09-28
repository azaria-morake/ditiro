import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import {
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  X
} from 'lucide-react-native';
import { COLORS, SPACING } from '../constants/theme';

interface CalendarClockModalProps {
  visible: boolean;
  initialDate?: Date;
  initialTab?: 'calendar' | 'clock';
  onConfirm: (date: Date) => void;
  onClose: () => void;
  title?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const CalendarClockModal: React.FC<CalendarClockModalProps> = ({
  visible,
  initialDate,
  initialTab = 'calendar',
  onConfirm,
  onClose,
  title = 'Set Date & Time'
}) => {
  const baseDate = initialDate || new Date();

  // Active sub-tab in modal: 'calendar' | 'clock'
  const [activeTab, setActiveTab] = useState<'calendar' | 'clock'>(initialTab);

  // Year & Month being viewed
  const [viewYear, setViewYear] = useState<number>(baseDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(baseDate.getMonth());

  // Chosen day, month, year
  const [selectedYear, setSelectedYear] = useState<number>(baseDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(baseDate.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(baseDate.getDate());

  // Chosen time
  const [hours, setHours] = useState<number>(baseDate.getHours());
  const [minutes, setMinutes] = useState<number>(baseDate.getMinutes());
  const [hoursText, setHoursText] = useState<string>(String(baseDate.getHours()).padStart(2, '0'));
  const [minutesText, setMinutesText] = useState<string>(String(baseDate.getMinutes()).padStart(2, '0'));

  useEffect(() => {
    if (visible) {
      const base = initialDate || new Date();
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
      setSelectedYear(base.getFullYear());
      setSelectedMonth(base.getMonth());
      setSelectedDay(base.getDate());
      const h = base.getHours();
      const m = base.getMinutes();
      setHours(h);
      setMinutes(m);
      setHoursText(String(h).padStart(2, '0'));
      setMinutesText(String(m).padStart(2, '0'));
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [visible, initialDate, initialTab]);

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Calendar matrix calculation
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay();

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayWeekday; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d);
  }

  const handleSelectDay = (day: number) => {
    setSelectedYear(viewYear);
    setSelectedMonth(viewMonth);
    setSelectedDay(day);
    // Switch to clock tab so user can verify or tweak time
    setActiveTab('clock');
  };

  // Clock Tuner Increment / Decrement
  const incrementHours = (delta: number) => {
    const next = (hours + delta + 24) % 24;
    setHours(next);
    setHoursText(String(next).padStart(2, '0'));
  };

  const incrementMinutes = (delta: number) => {
    const next = (minutes + delta + 60) % 60;
    setMinutes(next);
    setMinutesText(String(next).padStart(2, '0'));
  };

  // Arbitrary Typing in Inputs with live validation & backspace allowance
  const handleHoursChange = (val: string) => {
    const clean = val.replace(/[^\d]/g, '').slice(0, 2);
    setHoursText(clean);

    if (clean !== '') {
      let num = parseInt(clean, 10);
      if (num > 23) {
        num = 23;
        setHoursText('23');
      }
      setHours(num);
    }
  };

  const handleHoursBlur = () => {
    if (hoursText === '') {
      setHoursText(String(hours).padStart(2, '0'));
    } else {
      const num = Math.min(23, Math.max(0, parseInt(hoursText, 10) || 0));
      setHours(num);
      setHoursText(String(num).padStart(2, '0'));
    }
  };

  const handleMinutesChange = (val: string) => {
    const clean = val.replace(/[^\d]/g, '').slice(0, 2);
    setMinutesText(clean);

    if (clean !== '') {
      let num = parseInt(clean, 10);
      if (num > 59) {
        num = 59;
        setMinutesText('59');
      }
      setMinutes(num);
    }
  };

  const handleMinutesBlur = () => {
    if (minutesText === '') {
      setMinutesText(String(minutes).padStart(2, '0'));
    } else {
      const num = Math.min(59, Math.max(0, parseInt(minutesText, 10) || 0));
      setMinutes(num);
      setMinutesText(String(num).padStart(2, '0'));
    }
  };

  const handleQuickTimePreset = (h: number, m: number) => {
    setHours(h);
    setMinutes(m);
    setHoursText(String(h).padStart(2, '0'));
    setMinutesText(String(m).padStart(2, '0'));
  };

  const handleOffsetMinutes = (offset: number) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + offset);
    const h = d.getHours();
    const m = d.getMinutes();
    setHours(h);
    setMinutes(m);
    setHoursText(String(h).padStart(2, '0'));
    setMinutesText(String(m).padStart(2, '0'));
  };

  const handleSave = () => {
    const finalH = hoursText !== '' ? Math.min(23, Math.max(0, parseInt(hoursText, 10) || 0)) : hours;
    const finalM = minutesText !== '' ? Math.min(59, Math.max(0, parseInt(minutesText, 10) || 0)) : minutes;
    const finalDate = new Date(selectedYear, selectedMonth, selectedDay, finalH, finalM, 0, 0);
    onConfirm(finalDate);
    onClose();
  };

  const displayDateStr = new Date(selectedYear, selectedMonth, selectedDay).toLocaleDateString([], {
    month: 'short',
    day: 'numeric'
  });
  const displayTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={styles.dialogCard}>
          {/* Header */}
          <View style={styles.dialogHeader}>
            <View>
              <Text style={styles.dialogTitle}>{title}</Text>
              <Text style={styles.dialogSubtitle}>
                {displayDateStr} at {displayTimeStr}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={COLORS.mutedText} />
            </TouchableOpacity>
          </View>

          {/* Tab Switcher: Calendar vs Clock */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.modeTab, activeTab === 'calendar' && styles.modeTabActive]}
              onPress={() => setActiveTab('calendar')}
            >
              <CalendarIcon size={14} color={activeTab === 'calendar' ? COLORS.primaryAccent : COLORS.mutedText} />
              <Text style={[styles.modeTabText, activeTab === 'calendar' && styles.modeTabTextActive]}>
                Calendar ({displayDateStr})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, activeTab === 'clock' && styles.modeTabActive]}
              onPress={() => setActiveTab('clock')}
            >
              <ClockIcon size={14} color={activeTab === 'clock' ? COLORS.primaryAccent : COLORS.mutedText} />
              <Text style={[styles.modeTabText, activeTab === 'clock' && styles.modeTabTextActive]}>
                Clock ({displayTimeStr})
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: Calendar */}
          {activeTab === 'calendar' && (
            <View style={styles.calendarContainer}>
              <View style={styles.monthNavRow}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn}>
                  <ChevronLeft size={18} color={COLORS.softText} />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </Text>
                <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn}>
                  <ChevronRight size={18} color={COLORS.softText} />
                </TouchableOpacity>
              </View>

              {/* Weekday headers */}
              <View style={styles.weekdayRow}>
                {WEEKDAY_NAMES.map((name, idx) => (
                  <Text key={idx} style={styles.weekdayText}>
                    {name}
                  </Text>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.daysGrid}>
                {daysArray.map((day, idx) => {
                  if (day === null) {
                    return <View key={idx} style={styles.dayCellEmpty} />;
                  }

                  const isSelected =
                    selectedDay === day &&
                    selectedMonth === viewMonth &&
                    selectedYear === viewYear;

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                      onPress={() => handleSelectDay(day)}
                    >
                      <Text
                        style={[
                          styles.dayCellText,
                          isSelected && styles.dayCellTextSelected
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* TAB 2: Clock */}
          {activeTab === 'clock' && (
            <View style={styles.clockContainer}>
              <Text style={styles.clockLabel}>SET TIME (24-HOUR)</Text>

              {/* Big Digits Box */}
              <View style={styles.timeDigitRow}>
                {/* Hours Box */}
                <View style={styles.digitBox}>
                  <TouchableOpacity
                    style={styles.arrowBtn}
                    onPress={() => incrementHours(1)}
                  >
                    <Text style={styles.arrowText}>▲</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.timeInput}
                    value={hoursText}
                    onChangeText={handleHoursChange}
                    onBlur={handleHoursBlur}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus={true}
                    selectionColor={COLORS.primaryAccent}
                    placeholder="00"
                    placeholderTextColor={COLORS.mutedText}
                  />
                  <TouchableOpacity
                    style={styles.arrowBtn}
                    onPress={() => incrementHours(-1)}
                  >
                    <Text style={styles.arrowText}>▼</Text>
                  </TouchableOpacity>
                  <Text style={styles.digitSub}>HOURS</Text>
                </View>

                <Text style={styles.timeSeparator}>:</Text>

                {/* Minutes Box */}
                <View style={styles.digitBox}>
                  <TouchableOpacity
                    style={styles.arrowBtn}
                    onPress={() => incrementMinutes(5)}
                  >
                    <Text style={styles.arrowText}>▲</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.timeInput}
                    value={minutesText}
                    onChangeText={handleMinutesChange}
                    onBlur={handleMinutesBlur}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus={true}
                    selectionColor={COLORS.primaryAccent}
                    placeholder="00"
                    placeholderTextColor={COLORS.mutedText}
                  />
                  <TouchableOpacity
                    style={styles.arrowBtn}
                    onPress={() => incrementMinutes(-5)}
                  >
                    <Text style={styles.arrowText}>▼</Text>
                  </TouchableOpacity>
                  <Text style={styles.digitSub}>MINS</Text>
                </View>
              </View>

              {/* Quick Preset Buttons */}
              <Text style={styles.quickPresetsHeader}>QUICK PRESETS</Text>
              <View style={styles.quickTimeRow}>
                <TouchableOpacity
                  style={styles.timePresetChip}
                  onPress={() => handleQuickTimePreset(9, 0)}
                >
                  <Text style={styles.timePresetChipText}>09:00 AM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.timePresetChip}
                  onPress={() => handleQuickTimePreset(14, 0)}
                >
                  <Text style={styles.timePresetChipText}>14:00 PM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.timePresetChip}
                  onPress={() => handleQuickTimePreset(18, 0)}
                >
                  <Text style={styles.timePresetChipText}>18:00 PM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.timePresetChip}
                  onPress={() => handleQuickTimePreset(23, 59)}
                >
                  <Text style={styles.timePresetChipText}>23:59 EOD</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.timePresetChip}
                  onPress={() => handleOffsetMinutes(15)}
                >
                  <Text style={styles.timePresetChipText}>+15m</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.timePresetChip}
                  onPress={() => handleOffsetMinutes(60)}
                >
                  <Text style={styles.timePresetChipText}>+1h</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Footer Actions */}
          <View style={styles.dialogFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleSave}>
              <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.confirmBtnText}>Confirm & Set</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);
};

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E2023',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#383B42',
    padding: SPACING.md,
    elevation: 10
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm
  },
  dialogTitle: {
    color: COLORS.softText,
    fontSize: 16,
    fontWeight: '700'
  },
  dialogSubtitle: {
    color: COLORS.primaryAccent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#25272B'
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#16181B',
    borderRadius: 8,
    padding: 3,
    marginBottom: SPACING.md,
    gap: 4
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    gap: 5
  },
  modeTabActive: {
    backgroundColor: '#25272B'
  },
  modeTabText: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '600'
  },
  modeTabTextActive: {
    color: COLORS.primaryAccent
  },
  calendarContainer: {
    marginBottom: SPACING.md
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: 4
  },
  monthNavBtn: {
    padding: 6,
    backgroundColor: '#25272B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#383B42'
  },
  monthTitle: {
    color: COLORS.softText,
    fontSize: 14,
    fontWeight: '700'
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6
  },
  weekdayText: {
    width: 38,
    textAlign: 'center',
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '700'
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around'
  },
  dayCellEmpty: {
    width: 38,
    height: 36,
    marginVertical: 2
  },
  dayCell: {
    width: 38,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    marginVertical: 2
  },
  dayCellSelected: {
    backgroundColor: COLORS.primaryAccent
  },
  dayCellText: {
    color: COLORS.softText,
    fontSize: 13,
    fontWeight: '600'
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  clockContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md
  },
  clockLabel: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm
  },
  timeDigitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: SPACING.md
  },
  digitBox: {
    alignItems: 'center',
    backgroundColor: '#16181B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#383B42',
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 84
  },
  arrowBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12
  },
  arrowText: {
    color: COLORS.primaryAccent,
    fontSize: 12,
    fontWeight: '700'
  },
  timeInput: {
    color: COLORS.softText,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
    minWidth: 54
  },
  digitSub: {
    color: COLORS.mutedText,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4
  },
  timeSeparator: {
    color: COLORS.softText,
    fontSize: 26,
    fontWeight: '700'
  },
  quickPresetsHeader: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
    marginBottom: 6
  },
  quickTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  timePresetChip: {
    backgroundColor: '#25272B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#383B42'
  },
  timePresetChipText: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '600'
  },
  dialogFooter: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#25272B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#383B42'
  },
  cancelBtnText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '600'
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  }
});
