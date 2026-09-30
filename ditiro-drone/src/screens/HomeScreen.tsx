import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarClockModal } from '../components/CalendarClockModal';
import { EditDeedModal } from '../components/EditDeedModal';
import { Toast } from '../components/Toast';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { COLORS, SPACING } from '../constants/theme';
import {
  getDroneSettings,
  updateDroneSettings,
  subscribeUserTasks,
  updateTaskReminderToggle,
  toggleTaskStatus,
  createDroneTask,
  deleteDroneTask,
  updateDroneTask,
  DroneSettings,
  TaskReminder
} from '../services/droneSync';
import {
  registerForPushNotificationsAsync,
  sendTestNotification,
  scheduleCustomExactNotification,
  scheduleTaskNotifications,
  isTaskOverdue,
  setupBackgroundSyncTasks,
  unregisterBackgroundSyncTasks
} from '../services/notifications';
import { auth } from '../services/firebase';
import DitiroMonoSvg from '../../assets/ditiro-mono.svg';
import {
  LogOut,
  Bell,
  BellRing,
  RefreshCw,
  Clock,
  Sparkles,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Calendar,
  Mic,
  Inbox,
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  Lightbulb
} from 'lucide-react-native';

interface HomeScreenProps {
  user: any;
  onSignOut?: () => void;
}

const DRONE_TIPS = [
  'Tap any deed to edit its title, date, or time.',
  'Toggle the switch to mute or activate background alarms for a deed.',
  'Tap the circle checkbox on the left to mark a deed as completed.',
  'Tap Scout Active above to force-sync immediately with web Ditiro.',
  'Filter deeds anytime by Active, Overdue, or Completed above.',
  'Tap the trash icon to permanently remove a deed from your workspace.',
  'Configure your advance reminder lead times in System Controls.',
  'Background scout monitors your deeds even when the app is closed.',
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ user, onSignOut }) => {
  const [loading, setLoading] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<DroneSettings>({
    globalNotificationsEnabled: true,
    alertIntervalMinutes: 30,
    silentSyncEnabled: true,
    updatedAt: Date.now(),
  });
  const [tasks, setTasks] = useState<TaskReminder[]>([]);
  const [filter, setFilter] = useState<'active' | 'overdue' | 'completed'>('active');
  const [taskPage, setTaskPage] = useState(1);
  const TASKS_PER_PAGE = 10;

  // Rotating Tips State
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const tipOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(tipOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(tipOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        setCurrentTipIndex((prev) => (prev + 1) % DRONE_TIPS.length);
      }, 300);
    }, 7000);

    return () => clearInterval(timer);
  }, [tipOpacity]);

  const handleNextTip = () => {
    Animated.sequence([
      Animated.timing(tipOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(tipOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      setCurrentTipIndex((prev) => (prev + 1) % DRONE_TIPS.length);
    }, 150);
  };

  useEffect(() => {
    setTaskPage(1);
  }, [filter]);

  // Quick Deed Capture Form State
  const [newTitle, setNewTitle] = useState('');
  const [newInterval, setNewInterval] = useState(15);
  const [isAdding, setIsAdding] = useState(false);
  const [isTestingAlert, setIsTestingAlert] = useState(false);

  // Quick Deed Schedule Choice: 'today' | 'tomorrow' | 'set'
  const [deedDayChoice, setDeedDayChoice] = useState<'today' | 'tomorrow' | 'set'>('today');
  const [deedCustomDateTime, setDeedCustomDateTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    return d;
  });
  const [deedTimePreset, setDeedTimePreset] = useState<'23:59' | 'plus1h' | 'plus3h' | '09:00' | '14:00' | '18:00' | 'custom'>('23:59');
  const [deedCustomTimeStr, setDeedCustomTimeStr] = useState<string>('23:59');

  // System Controls Alert Subroutine: 'preset' | 'set'
  const [systemAlertMode, setSystemAlertMode] = useState<'preset' | 'set'>('preset');
  const [systemDayChoice, setSystemDayChoice] = useState<'today' | 'tomorrow' | 'set'>('today');
  const [systemCustomDateTime, setSystemCustomDateTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const [systemTimeStr, setSystemTimeStr] = useState<string>('12:00');
  const [customAlertTitle, setCustomAlertTitle] = useState('');
  const [isSchedulingCustom, setIsSchedulingCustom] = useState(false);
  const [customAlertNotice, setCustomAlertNotice] = useState<string | null>(null);

  // Edit Deed Modal State
  const [editingTask, setEditingTask] = useState<TaskReminder | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Toast State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const userId = user?.uid;
  const userEmail = user?.email;

  useEffect(() => {
    let unsubscribeTasks: (() => void) | undefined;

    async function initUserDroneSync() {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // 1. Fetch Drone Settings for authenticated user
        const storedSettings = await getDroneSettings(userId);
        setSettings(storedSettings);

        // 2. Register push token if available
        const token = await registerForPushNotificationsAsync(userId);
        setPushToken(token);

        // 3. Subscribe to real-time user tasks from Firestore
        unsubscribeTasks = subscribeUserTasks(userId, async (realTasks) => {
          setTasks(realTasks);
          setLoading(false);
          await scheduleTaskNotifications(realTasks, storedSettings.globalNotificationsEnabled);
        });
      } catch (err) {
        console.error('[HomeScreen] Sync error:', err);
        setLoading(false);
      }
    }

    initUserDroneSync();

    return () => {
      if (unsubscribeTasks) unsubscribeTasks();
    };
  }, [userId]);

  const toggleGlobalNotifications = async (val: boolean) => {
    if (!userId) return;
    const updated = { ...settings, globalNotificationsEnabled: val };
    setSettings(updated);
    await scheduleTaskNotifications(tasks, val);
    await updateDroneSettings(userId, { globalNotificationsEnabled: val });
  };

  const toggleSilentSync = async (val: boolean) => {
    if (!userId) return;
    const updated = { ...settings, silentSyncEnabled: val };
    setSettings(updated);
    if (val) {
      await setupBackgroundSyncTasks();
    } else {
      await unregisterBackgroundSyncTasks();
    }
    await updateDroneSettings(userId, { silentSyncEnabled: val });
  };

  const updateGlobalInterval = async (minutes: number) => {
    if (!userId) return;
    const updated = { ...settings, alertIntervalMinutes: minutes };
    setSettings(updated);
    await updateDroneSettings(userId, { alertIntervalMinutes: minutes });
  };

  const handleTaskReminderToggle = async (taskId: string, currentVal: boolean) => {
    if (!userId) return;
    const nextVal = !currentVal;
    const updatedTasks = tasks.map((t) => (t.id === taskId ? { ...t, remindersEnabled: nextVal } : t));
    setTasks(updatedTasks);
    await scheduleTaskNotifications(updatedTasks, settings.globalNotificationsEnabled);
    await updateTaskReminderToggle(userId, taskId, nextVal);
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: 'active' | 'completed') => {
    if (!userId) return;
    const nextStatus: 'active' | 'completed' = currentStatus === 'completed' ? 'active' : 'completed';
    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: nextStatus, remindersEnabled: nextStatus === 'active' }
        : t
    );
    setTasks(updatedTasks);
    await scheduleTaskNotifications(updatedTasks, settings.globalNotificationsEnabled);
    await toggleTaskStatus(userId, taskId, currentStatus);
    showToast(
      nextStatus === 'completed' ? 'Deed moved to Completed!' : 'Deed marked as Active!',
      'success'
    );
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!userId) return;
    const updatedTasks = tasks.filter((t) => t.id !== taskId);
    setTasks(updatedTasks);
    await scheduleTaskNotifications(updatedTasks, settings.globalNotificationsEnabled);
    await deleteDroneTask(userId, taskId);
    showToast('Deed deleted.', 'info');
  };

  const handleOpenEditModal = (task: TaskReminder) => {
    setEditingTask(task);
    setEditModalVisible(true);
  };

  const handleSaveEditedTask = async (updatedValues: {
    title: string;
    dueDate: string;
    dueTime: string;
    remindersEnabled: boolean;
    alertFrequencyMinutes: number;
    status: 'active' | 'completed';
    priority?: 'high' | 'medium' | 'low';
  }) => {
    if (!editingTask || !userId) return;
    const success = await updateDroneTask(userId, editingTask.id, updatedValues);
    if (success) {
      const updatedList = tasks.map((t) =>
        t.id === editingTask.id ? { ...t, ...updatedValues } : t
      );
      setTasks(updatedList);
      await scheduleTaskNotifications(updatedList, settings.globalNotificationsEnabled);
      showToast('Deed updated successfully!', 'success');
    } else {
      showToast('Failed to update deed. Please try again.', 'error');
    }
  };

  // Unified Calendar & Clock Modal State
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [pickerModalTarget, setPickerModalTarget] = useState<'deed' | 'system' | 'deed-time' | 'system-time'>('deed');

  const handleModalConfirm = (chosenDate: Date) => {
    const hrs = String(chosenDate.getHours()).padStart(2, '0');
    const mins = String(chosenDate.getMinutes()).padStart(2, '0');
    const timeStr = `${hrs}:${mins}`;

    if (pickerModalTarget === 'deed') {
      setDeedCustomDateTime(chosenDate);
      setDeedDayChoice('set');
    } else if (pickerModalTarget === 'deed-time') {
      setDeedCustomTimeStr(timeStr);
      setDeedTimePreset('custom');
      const updated = new Date(deedCustomDateTime);
      updated.setHours(chosenDate.getHours(), chosenDate.getMinutes(), 0, 0);
      setDeedCustomDateTime(updated);
    } else if (pickerModalTarget === 'system') {
      setSystemCustomDateTime(chosenDate);
      setSystemDayChoice('set');
      setSystemTimeStr(timeStr);
    } else if (pickerModalTarget === 'system-time') {
      setSystemTimeStr(timeStr);
      const updated = new Date(systemCustomDateTime);
      updated.setHours(chosenDate.getHours(), chosenDate.getMinutes(), 0, 0);
      setSystemCustomDateTime(updated);
    }
  };

  const getModalInitialDate = () => {
    if (pickerModalTarget === 'deed') return deedCustomDateTime;
    if (pickerModalTarget === 'deed-time') {
      const base = deedDayChoice === 'tomorrow' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : new Date();
      const [h, m] = deedCustomTimeStr.split(':').map(Number);
      base.setHours(isNaN(h) ? 23 : h, isNaN(m) ? 59 : m, 0, 0);
      return base;
    }
    if (pickerModalTarget === 'system') return systemCustomDateTime;
    if (pickerModalTarget === 'system-time') {
      const base = systemDayChoice === 'tomorrow' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : new Date();
      const [h, m] = systemTimeStr.split(':').map(Number);
      base.setHours(isNaN(h) ? 12 : h, isNaN(m) ? 0 : m, 0, 0);
      return base;
    }
    return new Date();
  };

  const getModalInitialTab = (): 'calendar' | 'clock' => {
    if (pickerModalTarget === 'deed-time' || pickerModalTarget === 'system-time') return 'clock';
    return 'calendar';
  };

  const getModalTitle = () => {
    if (pickerModalTarget === 'deed') return 'Set Deed Date & Time';
    if (pickerModalTarget === 'deed-time') return 'Set Deed Time';
    if (pickerModalTarget === 'system') return 'Set Alert Date & Time';
    if (pickerModalTarget === 'system-time') return 'Set Alert Time';
    return 'Set Date & Time';
  };

  const getResolvedDeedSchedule = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tYear = tomorrow.getFullYear();
    const tMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const tDay = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowStr = `${tYear}-${tMonth}-${tDay}`;

    if (deedDayChoice === 'today') {
      let resolvedTime = '23:59';
      let label = 'Today at 23:59';
      if (deedTimePreset === 'plus1h') {
        const target = new Date(now.getTime() + 60 * 60 * 1000);
        resolvedTime = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
        label = `Today at ${resolvedTime} (+1h)`;
      } else if (deedTimePreset === 'plus3h') {
        const target = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        resolvedTime = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
        label = `Today at ${resolvedTime} (+3h)`;
      } else if (deedTimePreset === 'custom') {
        resolvedTime = deedCustomTimeStr;
        label = `Today at ${resolvedTime}`;
      }
      return { date: todayStr, time: resolvedTime, display: label };
    }

    if (deedDayChoice === 'tomorrow') {
      let resolvedTime = '09:00';
      if (deedTimePreset === '23:59') resolvedTime = '23:59';
      else if (deedTimePreset === '14:00') resolvedTime = '14:00';
      else if (deedTimePreset === '18:00') resolvedTime = '18:00';
      else if (deedTimePreset === 'custom') resolvedTime = deedCustomTimeStr;
      return { date: tomorrowStr, time: resolvedTime, display: `Tomorrow at ${resolvedTime}` };
    }

    // 'set' mode: pulled from native / browser calendar and clock
    const y = deedCustomDateTime.getFullYear();
    const m = String(deedCustomDateTime.getMonth() + 1).padStart(2, '0');
    const d = String(deedCustomDateTime.getDate()).padStart(2, '0');
    const hrs = String(deedCustomDateTime.getHours()).padStart(2, '0');
    const mins = String(deedCustomDateTime.getMinutes()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const timeStr = `${hrs}:${mins}`;
    const dateFormatted = deedCustomDateTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return { date: dateStr, time: timeStr, display: `${dateFormatted} at ${timeStr}` };
  };

  const getResolvedSystemAlertTarget = (): Date => {
    const now = new Date();
    if (systemDayChoice === 'today') {
      const [h, m] = systemTimeStr.split(':').map(Number);
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 12, m || 0, 0, 0);
    }
    if (systemDayChoice === 'tomorrow') {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const [h, m] = systemTimeStr.split(':').map(Number);
      return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), h || 9, m || 0, 0, 0);
    }
    return systemCustomDateTime;
  };

  const handleCreateTask = async () => {
    if (!userId || !newTitle.trim() || isAdding) return;
    setIsAdding(true);
    try {
      const schedule = getResolvedDeedSchedule();
      const created = await createDroneTask(
        userId,
        newTitle.trim(),
        schedule.date,
        schedule.time,
        newInterval
      );
      if (created) {
        setNewTitle('');
        setFilter('active');
      }
    } catch (err) {
      console.error('[HomeScreen] Error creating task:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleScheduleCustomAlert = async () => {
    if (isSchedulingCustom) return;
    setIsSchedulingCustom(true);
    setCustomAlertNotice(null);

    try {
      const targetDate = getResolvedSystemAlertTarget();

      if (targetDate.getTime() <= Date.now()) {
        Alert.alert('Past Time Selected', 'Please select a future date and time for the alert.');
        setIsSchedulingCustom(false);
        return;
      }

      const id = await scheduleCustomExactNotification(
        customAlertTitle.trim() || '🛸 Ditiro Custom Alert',
        targetDate
      );

      if (id) {
        setCustomAlertNotice(
          `Alert set for ${targetDate.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          })} at ${targetDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        );
      }
    } catch (err) {
      console.error('[HomeScreen] Schedule custom alert error:', err);
    } finally {
      setIsSchedulingCustom(false);
    }
  };

  const handleTriggerTest = async () => {
    setIsTestingAlert(true);
    try {
      await sendTestNotification();
    } catch (e) {
      console.error('[HomeScreen] Test notification error:', e);
    } finally {
      setIsTestingAlert(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of Ditiro Drone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              if (Platform.OS !== 'web') {
                try {
                  await GoogleSignin.signOut();
                } catch (gErr) {
                  console.log('[HomeScreen] Google Sign-Out error (safe to ignore):', gErr);
                }
              }
              await auth.signOut();
              if (onSignOut) onSignOut();
            } catch (err) {
              console.error('[HomeScreen] Sign out failed:', err);
            }
          },
        },
      ]
    );
  };

  const handleSwitchAccount = () => {
    Alert.alert(
      'Switch Account',
      'Are you sure you want to switch accounts? You will be signed out so you can sign in with another account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch Account',
          onPress: async () => {
            try {
              if (Platform.OS !== 'web') {
                try {
                  await GoogleSignin.signOut();
                } catch (gErr) {
                  console.log('[HomeScreen] Google Sign-Out error (safe to ignore):', gErr);
                }
              }
              await auth.signOut();
              if (onSignOut) onSignOut();
            } catch (err) {
              console.error('[HomeScreen] Switch account failed:', err);
            }
          },
        },
      ]
    );
  };

  const activeCount = tasks.filter((t) => t.status === 'active' && !isTaskOverdue(t.dueDate, t.dueTime)).length;
  const overdueCount = tasks.filter((t) => t.status === 'active' && isTaskOverdue(t.dueDate, t.dueTime)).length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  const filteredTasks = tasks.filter((task) => {
    const overdue = isTaskOverdue(task.dueDate, task.dueTime);
    if (filter === 'active') return task.status === 'active' && !overdue;
    if (filter === 'overdue') return task.status === 'active' && overdue;
    if (filter === 'completed') return task.status === 'completed';
    return false;
  });

  const totalPages = Math.ceil(filteredTasks.length / TASKS_PER_PAGE) || 1;
  const currentPage = Math.min(taskPage, totalPages);
  const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
  const endIndex = Math.min(startIndex + TASKS_PER_PAGE, filteredTasks.length);
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primaryAccent} />
        <Text style={styles.loadingText}>Connecting to Ditiro Cloud Workspace...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.badgeRow}>
              <DitiroMonoSvg width={14} height={16} color={COLORS.proteaOrange} fill={COLORS.proteaOrange} />
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>SCOUT ACTIVE</Text>
              </View>
            </View>
            <Text style={styles.title}>DITIRO DRONE</Text>
            <Text style={styles.subtitle}>Mobile Native Capture & Alert Layer</Text>
          </View>

          <TouchableOpacity style={styles.signOutHeaderButton} onPress={handleSignOut}>
            <LogOut size={14} color={COLORS.softText} style={{ marginRight: 6 }} />
            <Text style={styles.signOutHeaderButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* User Session Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <ShieldCheck size={16} color={COLORS.primaryAccent} />
              <Text style={styles.cardTitle}>ACCOUNT & CLOUD SESSION</Text>
            </View>
          </View>

          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>Connected Account:</Text>
            <Text style={styles.sessionValue}>{userEmail || 'Authenticated User'}</Text>
          </View>

          <View style={styles.sessionActionRow}>
            <TouchableOpacity style={styles.switchAccountButton} onPress={handleSwitchAccount}>
              <ArrowLeftRight size={13} color={COLORS.primaryAccent} style={{ marginRight: 6 }} />
              <Text style={styles.switchAccountButtonText}>Switch Account</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutCardButton} onPress={handleSignOut}>
              <LogOut size={13} color={COLORS.softText} style={{ marginRight: 6 }} />
              <Text style={styles.signOutCardButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Deed Capture Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <Plus size={16} color={COLORS.primaryAccent} />
              <Text style={styles.cardTitle}>QUICK DEED CAPTURE</Text>
            </View>
            <View style={styles.scheduleBadge}>
              <Text style={styles.scheduleBadgeText} numberOfLines={1}>
                {getResolvedDeedSchedule().display}
              </Text>
            </View>
          </View>

          <View style={styles.quickAddRow}>
            <TextInput
              style={styles.quickAddInput}
              placeholder="What deed needs to be done?"
              placeholderTextColor="#6B7280"
              value={newTitle}
              onChangeText={setNewTitle}
              onSubmitEditing={handleCreateTask}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[
                styles.quickAddButton,
                (!newTitle.trim() || isAdding) && styles.quickAddButtonDisabled
              ]}
              onPress={handleCreateTask}
              disabled={!newTitle.trim() || isAdding}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Plus size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Schedule Mode Selector: Today | Tomorrow | Set */}
          <View style={styles.segmentedDayRow}>
            <TouchableOpacity
              style={[
                styles.segmentedDayTab,
                deedDayChoice === 'today' && styles.segmentedDayTabActive,
              ]}
              onPress={() => {
                setDeedDayChoice('today');
                setDeedTimePreset('23:59');
              }}
            >
              <Text
                style={[
                  styles.segmentedDayTabText,
                  deedDayChoice === 'today' && styles.segmentedDayTabTextActive,
                ]}
              >
                Today
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentedDayTab,
                deedDayChoice === 'tomorrow' && styles.segmentedDayTabActive,
              ]}
              onPress={() => {
                setDeedDayChoice('tomorrow');
                setDeedTimePreset('09:00');
              }}
            >
              <Text
                style={[
                  styles.segmentedDayTabText,
                  deedDayChoice === 'tomorrow' && styles.segmentedDayTabTextActive,
                ]}
              >
                Tomorrow
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentedDayTab,
                deedDayChoice === 'set' && styles.segmentedDayTabActive,
              ]}
              onPress={() => {
                setDeedDayChoice('set');
                setPickerModalTarget('deed');
                setPickerModalVisible(true);
              }}
            >
              <Calendar size={13} color={deedDayChoice === 'set' ? COLORS.primaryAccent : COLORS.mutedText} />
              <Text
                style={[
                  styles.segmentedDayTabText,
                  deedDayChoice === 'set' && styles.segmentedDayTabTextActive,
                ]}
              >
                Set
              </Text>
            </TouchableOpacity>
          </View>

          {/* Time Options for chosen day */}
          {deedDayChoice === 'today' && (
            <View style={styles.timeChipsRow}>
              {[
                { key: '23:59', label: '23:59 (EOD)' },
                { key: 'plus1h', label: '+1h' },
                { key: 'plus3h', label: '+3h' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.timeChip,
                    deedTimePreset === opt.key && styles.timeChipActive,
                  ]}
                  onPress={() => setDeedTimePreset(opt.key as any)}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      deedTimePreset === opt.key && styles.timeChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[
                  styles.timeChip,
                  deedTimePreset === 'custom' && styles.timeChipActive,
                ]}
                onPress={() => {
                  setPickerModalTarget('deed-time');
                  setPickerModalVisible(true);
                }}
              >
                <Clock size={11} color={deedTimePreset === 'custom' ? COLORS.primaryAccent : COLORS.mutedText} />
                <Text
                  style={[
                    styles.timeChipText,
                    deedTimePreset === 'custom' && styles.timeChipTextActive,
                  ]}
                >
                  {deedTimePreset === 'custom' ? deedCustomTimeStr : 'Clock'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {deedDayChoice === 'tomorrow' && (
            <View style={styles.timeChipsRow}>
              {[
                { key: '09:00', label: '09:00 AM' },
                { key: '14:00', label: '14:00 PM' },
                { key: '18:00', label: '18:00 PM' },
                { key: '23:59', label: '23:59 EOD' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.timeChip,
                    deedTimePreset === opt.key && styles.timeChipActive,
                  ]}
                  onPress={() => setDeedTimePreset(opt.key as any)}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      deedTimePreset === opt.key && styles.timeChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[
                  styles.timeChip,
                  deedTimePreset === 'custom' && styles.timeChipActive,
                ]}
                onPress={() => {
                  setPickerModalTarget('deed-time');
                  setPickerModalVisible(true);
                }}
              >
                <Clock size={11} color={deedTimePreset === 'custom' ? COLORS.primaryAccent : COLORS.mutedText} />
                <Text
                  style={[
                    styles.timeChipText,
                    deedTimePreset === 'custom' && styles.timeChipTextActive,
                  ]}
                >
                  {deedTimePreset === 'custom' ? deedCustomTimeStr : 'Clock'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {deedDayChoice === 'set' && (
            <TouchableOpacity
              style={styles.customConfirmedBanner}
              onPress={() => {
                setPickerModalTarget('deed');
                setPickerModalVisible(true);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} color={COLORS.primaryAccent} />
                <Text style={styles.customConfirmedText}>
                  {getResolvedDeedSchedule().display}
                </Text>
              </View>
              <Text style={styles.customChangeHint}>Tap to change</Text>
            </TouchableOpacity>
          )}

          {/* Alert Interval Cadence */}
          <View style={{ marginTop: SPACING.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm }}>
              <BellRing size={13} color={COLORS.mutedText} />
              <Text style={styles.intervalHeader}>REMINDER CADENCE</Text>
            </View>

            <View style={styles.intervalRow}>
              {[15, 30, 60].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[
                    styles.intervalPill,
                    newInterval === mins && styles.intervalPillActive,
                  ]}
                  onPress={() => setNewInterval(mins)}
                >
                  <Text
                    style={[
                      styles.intervalPillText,
                      newInterval === mins && styles.intervalPillTextActive,
                    ]}
                  >
                    {mins} min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* System Controls Section */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <Bell size={16} color={COLORS.primaryAccent} />
              <Text style={styles.cardTitle}>SYSTEM CONTROLS</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowLabelContainer}>
              <Text style={styles.rowTitle}>Global Reminders</Text>
              <Text style={styles.rowSubtitle}>Receive native push alerts on device</Text>
            </View>
            <Switch
              value={settings.globalNotificationsEnabled}
              onValueChange={toggleGlobalNotifications}
              trackColor={{ false: '#383B42', true: COLORS.primaryAccent }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLabelContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={14} color={COLORS.softText} />
                <Text style={styles.rowTitle}>Silent Background Sync</Text>
              </View>
              <Text style={styles.rowSubtitle}>FCM payload sync without foregrounding</Text>
            </View>
            <Switch
              value={settings.silentSyncEnabled}
              onValueChange={toggleSilentSync}
              trackColor={{ false: '#383B42', true: COLORS.primaryAccent }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          {/* Subroutine Mode Selector for Alert Cadence / Custom Scheduled Alert */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Clock size={13} color={COLORS.mutedText} />
              <Text style={styles.intervalHeader}>ALERT CADENCE</Text>
            </View>

            <View style={styles.systemSubroutineSwitch}>
              <TouchableOpacity
                style={[
                  styles.systemSubTab,
                  systemAlertMode === 'preset' && styles.systemSubTabActive,
                ]}
                onPress={() => setSystemAlertMode('preset')}
              >
                <Text
                  style={[
                    styles.systemSubTabText,
                    systemAlertMode === 'preset' && styles.systemSubTabTextActive,
                  ]}
                >
                  Presets
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.systemSubTab,
                  systemAlertMode === 'set' && styles.systemSubTabActive,
                ]}
                onPress={() => setSystemAlertMode('set')}
              >
                <Text
                  style={[
                    styles.systemSubTabText,
                    systemAlertMode === 'set' && styles.systemSubTabTextActive,
                  ]}
                >
                  Set
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {systemAlertMode === 'preset' ? (
            <View>
              <View style={styles.intervalRow}>
                {[15, 30, 60].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    style={[
                      styles.intervalPill,
                      settings.alertIntervalMinutes === mins && styles.intervalPillActive,
                    ]}
                    onPress={() => updateGlobalInterval(mins)}
                  >
                    <Text
                      style={[
                        styles.intervalPillText,
                        settings.alertIntervalMinutes === mins && styles.intervalPillTextActive,
                      ]}
                    >
                      {mins} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.intervalSubtext}>
                Default heads-up alert will trigger {settings.alertIntervalMinutes} mins prior to deed due time.
              </Text>
            </View>
          ) : (
            <View style={styles.systemSetContainer}>
              <Text style={styles.subroutineSectionLabel}>SELECT TARGET ALERT TIME</Text>

              <View style={styles.segmentedDayRow}>
                <TouchableOpacity
                  style={[
                    styles.segmentedDayTab,
                    systemDayChoice === 'today' && styles.segmentedDayTabActive,
                  ]}
                  onPress={() => setSystemDayChoice('today')}
                >
                  <Text
                    style={[
                      styles.segmentedDayTabText,
                      systemDayChoice === 'today' && styles.segmentedDayTabTextActive,
                    ]}
                  >
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentedDayTab,
                    systemDayChoice === 'tomorrow' && styles.segmentedDayTabActive,
                  ]}
                  onPress={() => setSystemDayChoice('tomorrow')}
                >
                  <Text
                    style={[
                      styles.segmentedDayTabText,
                      systemDayChoice === 'tomorrow' && styles.segmentedDayTabTextActive,
                    ]}
                  >
                    Tomorrow
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentedDayTab,
                    systemDayChoice === 'set' && styles.segmentedDayTabActive,
                  ]}
                  onPress={() => {
                    setSystemDayChoice('set');
                    setPickerModalTarget('system');
                    setPickerModalVisible(true);
                  }}
                >
                  <Calendar size={13} color={systemDayChoice === 'set' ? COLORS.primaryAccent : COLORS.mutedText} />
                  <Text
                    style={[
                      styles.segmentedDayTabText,
                      systemDayChoice === 'set' && styles.segmentedDayTabTextActive,
                    ]}
                  >
                    Set
                  </Text>
                </TouchableOpacity>
              </View>

              {systemDayChoice !== 'set' ? (
                <TouchableOpacity
                  style={styles.customConfirmedBanner}
                  onPress={() => {
                    setPickerModalTarget('system-time');
                    setPickerModalVisible(true);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} color={COLORS.primaryAccent} />
                    <Text style={styles.customConfirmedText}>
                      Clock: {systemTimeStr}
                    </Text>
                  </View>
                  <Text style={styles.customChangeHint}>Tap to change clock</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.customConfirmedBanner}
                  onPress={() => {
                    setPickerModalTarget('system');
                    setPickerModalVisible(true);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} color={COLORS.primaryAccent} />
                    <Text style={styles.customConfirmedText}>
                      {systemCustomDateTime.toLocaleDateString([], { month: 'short', day: 'numeric' })} at {systemCustomDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={styles.customChangeHint}>Tap to change</Text>
                </TouchableOpacity>
              )}

              <TextInput
                style={[styles.customDateInput, { marginTop: SPACING.sm }]}
                placeholder="Alert Label (Optional, e.g. Daily Standup)"
                placeholderTextColor={COLORS.mutedText}
                value={customAlertTitle}
                onChangeText={setCustomAlertTitle}
              />

              <TouchableOpacity
                style={styles.scheduleCustomButton}
                onPress={handleScheduleCustomAlert}
                disabled={isSchedulingCustom}
              >
                {isSchedulingCustom ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.testNotificationContent}>
                    <BellRing size={14} color="#FFFFFF" />
                    <Text style={styles.testNotificationText}>Schedule Exact Alert</Text>
                  </View>
                )}
              </TouchableOpacity>

              {customAlertNotice && (
                <View style={styles.customNoticeBox}>
                  <CheckCircle2 size={13} color={COLORS.success} />
                  <Text style={styles.customNoticeText}>{customAlertNotice}</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.testNotificationButton}
            onPress={handleTriggerTest}
            disabled={isTestingAlert}
          >
            {isTestingAlert ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.testNotificationContent}>
                <BellRing size={14} color="#FFFFFF" />
                <Text style={styles.testNotificationText}>Trigger Instant Test Notification</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Real-time Task-Centric Alerts & Reminders */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <CheckCircle2 size={16} color={COLORS.primaryAccent} />
              <Text style={styles.cardTitle}>WORKSPACE DEEDS</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.taskCount}>{activeCount} Active</Text>
              {overdueCount > 0 && (
                <Text style={styles.overdueCount}>({overdueCount} Overdue)</Text>
              )}
            </View>
          </View>

          {/* Filter Tabs */}
          <View style={styles.filterRow}>
            {(['active', 'overdue', 'completed'] as const).map((tab) => {
              const count =
                tab === 'active'
                  ? activeCount
                  : tab === 'overdue'
                    ? overdueCount
                    : completedCount;

              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.filterTab, filter === tab && styles.filterTabActive]}
                  onPress={() => setFilter(tab)}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      filter === tab && styles.filterTabTextActive,
                      tab === 'overdue' && overdueCount > 0 && styles.overdueTabText,
                    ]}
                  >
                    {tab.toUpperCase()} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {filteredTasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Inbox size={36} color={COLORS.mutedText} style={{ marginBottom: SPACING.sm }} />
              <Text style={styles.emptyTitle}>
                {filter === 'completed'
                  ? 'No Completed Deeds Yet'
                  : filter === 'overdue'
                    ? 'No Overdue Deeds'
                    : 'No Active Tasks Found'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'completed'
                  ? 'Check off deeds above to mark them as completed!'
                  : filter === 'overdue'
                    ? 'No past-due deeds require your immediate attention.'
                    : 'Tasks created here or in Ditiro Web will automatically sync in real-time.'}
              </Text>
            </View>
          ) : (
            <>
              {paginatedTasks.map((task) => {
                const isOverdue = isTaskOverdue(task.dueDate, task.dueTime) && task.status === 'active';

                return (
                  <View key={task.id} style={styles.taskItem}>
                    {/* Completion Checkbox */}
                    <TouchableOpacity
                      style={styles.checkboxTouch}
                      onPress={() => handleToggleTaskStatus(task.id, task.status)}
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 size={22} color={COLORS.primaryAccent} />
                      ) : (
                        <Circle size={22} color={isOverdue ? '#EF4444' : COLORS.mutedText} />
                      )}
                    </TouchableOpacity>

                    {/* Task Details - Tap to Modify */}
                    <TouchableOpacity
                      style={styles.taskInfo}
                      activeOpacity={0.7}
                      onPress={() => handleOpenEditModal(task)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text
                          style={[
                            styles.taskTitle,
                            task.status === 'completed' && styles.taskTitleCompleted
                          ]}
                          numberOfLines={1}
                        >
                          {task.title}
                        </Text>
                        {isOverdue && (
                          <View style={styles.overdueBadge}>
                            <AlertTriangle size={10} color="#EF4444" />
                            <Text style={styles.overdueBadgeText}>OVERDUE</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.taskMetaRow}>
                        <Calendar size={12} color={isOverdue ? '#EF4444' : COLORS.mutedText} />
                        <Text
                          style={[styles.taskMeta, isOverdue && styles.taskMetaOverdue]}
                          numberOfLines={1}
                        >
                          Due: {task.dueDate} at {task.dueTime}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Actions: Delete & Reminder Switch */}
                    <View style={styles.taskActionsRow}>
                      <TouchableOpacity
                        style={styles.taskDeleteButton}
                        onPress={() => handleDeleteTask(task.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={16} color={COLORS.mutedText} />
                      </TouchableOpacity>

                      <Switch
                        value={task.remindersEnabled && settings.globalNotificationsEnabled && task.status === 'active' && !isOverdue}
                        disabled={!settings.globalNotificationsEnabled || task.status === 'completed' || isOverdue}
                        onValueChange={() => handleTaskReminderToggle(task.id, task.remindersEnabled)}
                        trackColor={{ false: '#383B42', true: COLORS.primaryAccent }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>
                );
              })}

              {filteredTasks.length > TASKS_PER_PAGE && (
                <View style={styles.paginationRow}>
                  <Text style={styles.paginationInfo}>
                    Showing {startIndex + 1}–{endIndex} of {filteredTasks.length} deeds
                  </Text>

                  <View style={styles.paginationButtons}>
                    <TouchableOpacity
                      style={[styles.pageArrowButton, currentPage === 1 && styles.pageArrowButtonDisabled]}
                      onPress={() => setTaskPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft size={16} color={currentPage === 1 ? '#4B5563' : COLORS.primaryAccent} />
                    </TouchableOpacity>

                    <View style={styles.pageNumberBadge}>
                      <Text style={styles.pageNumberText}>{currentPage} / {totalPages}</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.pageArrowButton, currentPage === totalPages && styles.pageArrowButtonDisabled]}
                      onPress={() => setTaskPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight size={16} color={currentPage === totalPages ? '#4B5563' : COLORS.primaryAccent} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Rotating Drone Tips Footer */}
          <TouchableOpacity
            style={styles.tipBannerContainer}
            activeOpacity={0.75}
            onPress={handleNextTip}
          >
            <View style={styles.tipIconBadge}>
              <Lightbulb size={12} color={COLORS.primaryAccent} />
            </View>
            <Animated.Text
              style={[styles.tipBannerText, { opacity: tipOpacity }]}
              numberOfLines={2}
            >
              {DRONE_TIPS[currentTipIndex]}
            </Animated.Text>
          </TouchableOpacity>
        </View>

        {/* Future Extension: Hands-Free Voice Capture Slot */}
        <View style={styles.voiceCard}>
          <View style={styles.voiceIconPlaceholder}>
            <Mic size={22} color={COLORS.primaryAccent} />
          </View>
          <View style={styles.voiceTextContainer}>
            <Text style={styles.voiceTitle}>Voice Evocation Engine</Text>
            <Text style={styles.voiceSubtitle}>"Hello Ditiro" hands-free task capture coming in future release.</Text>
          </View>
        </View>

        <Text style={styles.footerNote}>
          Token: {pushToken ? `${pushToken.substring(0, 22)}...` : 'Local Tray & Push Notification Scout Active'}
        </Text>
      </ScrollView>

      {/* Zero-native-dependency Calendar & Clock Modal */}
      <CalendarClockModal
        visible={pickerModalVisible}
        initialDate={getModalInitialDate()}
        initialTab={getModalInitialTab()}
        title={getModalTitle()}
        onConfirm={handleModalConfirm}
        onClose={() => setPickerModalVisible(false)}
      />

      {/* Modify Deed Modal */}
      <EditDeedModal
        visible={editModalVisible}
        task={editingTask}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveEditedTask}
      />

      {/* Floating Confirmation Toast */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.softText,
    marginTop: SPACING.md,
    fontSize: 14,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  signOutHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#383B42',
  },
  signOutHeaderButtonText: {
    color: COLORS.softText,
    fontSize: 12,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: SPACING.xs,
  },
  badgePill: {
    backgroundColor: COLORS.proteaOrange,
    paddingHorizontal: 8,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: COLORS.sunGold,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    lineHeight: 11,
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
    transform: [{ translateY: 0.75 }],
  },
  title: {
    color: COLORS.softText,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  taskCount: {
    color: COLORS.primaryAccent,
    fontSize: 12,
    fontWeight: '600',
  },
  overdueCount: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  sessionLabel: {
    color: COLORS.mutedText,
    fontSize: 13,
  },
  sessionValue: {
    color: COLORS.primaryAccent,
    fontSize: 13,
    fontWeight: '600',
  },
  sessionActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#282B33',
  },
  switchAccountButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(224, 80, 18, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(224, 80, 18, 0.3)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  switchAccountButtonText: {
    color: COLORS.primaryAccent,
    fontSize: 12,
    fontWeight: '700',
  },
  signOutCardButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#282B33',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  signOutCardButtonText: {
    color: COLORS.softText,
    fontSize: 12,
    fontWeight: '600',
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  quickAddInput: {
    flex: 1,
    backgroundColor: '#16181B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  quickAddButton: {
    backgroundColor: COLORS.primaryAccent,
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAddButtonDisabled: {
    opacity: 0.5,
  },
  quickMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  quickMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickMetaLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
  },
  quickCadenceOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  cadencePill: {
    backgroundColor: '#25272B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cadencePillActive: {
    backgroundColor: COLORS.primaryAccentAlpha,
    borderColor: COLORS.primaryAccent,
  },
  cadencePillText: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '600',
  },
  cadencePillTextActive: {
    color: COLORS.primaryAccent,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  rowLabelContainer: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  rowTitle: {
    color: COLORS.softText,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: COLORS.mutedText,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: SPACING.md,
  },
  intervalHeader: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  intervalPill: {
    flex: 1,
    backgroundColor: '#2B2D31',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  intervalPillActive: {
    backgroundColor: COLORS.primaryAccentAlpha,
    borderColor: COLORS.primaryAccent,
  },
  intervalPillText: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '600',
  },
  intervalPillTextActive: {
    color: COLORS.primaryAccent,
  },
  testNotificationButton: {
    backgroundColor: COLORS.primaryAccent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  testNotificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  testNotificationText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  scheduleBadge: {
    backgroundColor: COLORS.primaryAccentAlpha,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 140, 43, 0.4)',
    maxWidth: '55%',
  },
  scheduleBadgeText: {
    color: COLORS.primaryAccent,
    fontSize: 10,
    fontWeight: '700',
  },
  segmentedDayRow: {
    flexDirection: 'row',
    backgroundColor: '#16181B',
    borderRadius: 8,
    padding: 3,
    marginTop: SPACING.sm,
    gap: 4,
  },
  segmentedDayTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    gap: 5,
  },
  segmentedDayTabActive: {
    backgroundColor: '#25272B',
  },
  segmentedDayTabText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '600',
  },
  segmentedDayTabTextActive: {
    color: COLORS.primaryAccent,
  },
  timeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: SPACING.sm,
  },
  timeChip: {
    backgroundColor: '#25272B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeChipActive: {
    backgroundColor: COLORS.primaryAccentAlpha,
    borderColor: COLORS.primaryAccent,
  },
  timeChipText: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '600',
  },
  timeChipTextActive: {
    color: COLORS.primaryAccent,
  },
  customConfirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#25272B',
    borderWidth: 1,
    borderColor: COLORS.primaryAccent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: SPACING.sm,
  },
  customConfirmedText: {
    color: COLORS.softText,
    fontSize: 12,
    fontWeight: '600',
  },
  customChangeHint: {
    color: COLORS.primaryAccent,
    fontSize: 11,
    fontWeight: '600',
  },
  customDateInput: {
    backgroundColor: '#16181B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    color: COLORS.softText,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    fontSize: 12,
    marginTop: 6,
  },
  subroutineSectionLabel: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  systemSubroutineSwitch: {
    flexDirection: 'row',
    backgroundColor: '#16181B',
    borderRadius: 6,
    padding: 2,
    gap: 2,
  },
  systemSubTab: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  systemSubTabActive: {
    backgroundColor: '#25272B',
  },
  systemSubTabText: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '600',
  },
  systemSubTabTextActive: {
    color: COLORS.primaryAccent,
  },
  intervalSubtext: {
    color: COLORS.mutedText,
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },
  systemSetContainer: {
    marginTop: 4,
    padding: SPACING.sm,
    backgroundColor: '#16181B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2B2D31',
  },
  scheduleCustomButton: {
    backgroundColor: COLORS.primaryAccent,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  customNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(78, 170, 106, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(78, 170, 106, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: SPACING.sm,
  },
  customNoticeText: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#16181B',
    borderRadius: 8,
    padding: 3,
    marginBottom: SPACING.md,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: '#25272B',
  },
  filterTabText: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: COLORS.primaryAccent,
  },
  overdueTabText: {
    color: '#EF4444',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#25272B',
    gap: SPACING.sm,
  },
  checkboxTouch: {
    padding: 4,
  },
  taskInfo: {
    flex: 1,
    marginRight: 6,
  },
  taskTitle: {
    color: COLORS.softText,
    fontSize: 14,
    fontWeight: '500',
  },
  taskTitleCompleted: {
    color: COLORS.mutedText,
    textDecorationLine: 'line-through',
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  overdueBadgeText: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  taskMeta: {
    color: COLORS.mutedText,
    fontSize: 11,
  },
  taskMetaOverdue: {
    color: '#EF4444',
    fontWeight: '600',
  },
  taskActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  taskDeleteButton: {
    padding: 6,
  },
  tipBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#25272B',
  },
  tipIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(234, 165, 36, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipBannerText: {
    flex: 1,
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
  emptyContainer: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  emptyTitle: {
    color: COLORS.softText,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: COLORS.mutedText,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: SPACING.md,
  },
  voiceCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.9,
  },
  voiceIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryAccentAlpha,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primaryAccent,
  },
  voiceTextContainer: {
    flex: 1,
  },
  voiceTitle: {
    color: COLORS.softText,
    fontSize: 14,
    fontWeight: '600',
  },
  voiceSubtitle: {
    color: COLORS.mutedText,
    fontSize: 12,
    marginTop: 2,
  },
  footerNote: {
    color: COLORS.mutedText,
    fontSize: 11,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#25272B',
  },
  paginationInfo: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '600',
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageArrowButton: {
    backgroundColor: '#16181B',
    borderWidth: 1,
    borderColor: '#383B42',
    borderRadius: 6,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageArrowButtonDisabled: {
    borderColor: '#25272B',
    opacity: 0.35,
  },
  pageNumberBadge: {
    backgroundColor: '#25272B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  pageNumberText: {
    color: COLORS.softText,
    fontSize: 11,
    fontWeight: '700',
  },
});
