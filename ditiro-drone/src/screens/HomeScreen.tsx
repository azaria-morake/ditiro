import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  ScrollView,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import {
  getDroneSettings,
  updateDroneSettings,
  subscribeUserTasks,
  updateTaskReminderToggle,
  DroneSettings,
  TaskReminder
} from '../services/droneSync';
import {
  registerForPushNotificationsAsync,
  sendTestNotification,
  scheduleTaskNotifications
} from '../services/notifications';
import { auth } from '../services/firebase';

interface HomeScreenProps {
  user: any;
  onSignOut?: () => void;
}

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
        unsubscribeTasks = subscribeUserTasks(userId, (realTasks) => {
          setTasks(realTasks);
          setLoading(false);
          scheduleTaskNotifications(realTasks, storedSettings.globalNotificationsEnabled);
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
    // Optimistic UI update and schedule update
    setTasks(updatedTasks);
    await scheduleTaskNotifications(updatedTasks, settings.globalNotificationsEnabled);
    await updateTaskReminderToggle(userId, taskId, nextVal);
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      if (onSignOut) onSignOut();
    } catch (err) {
      console.error('[HomeScreen] Sign out failed:', err);
    }
  };

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
          <View>
            <View style={styles.badgeRow}>
              <View style={styles.activeDot} />
              <Text style={styles.badgeText}>SCOUT ACTIVE</Text>
            </View>
            <Text style={styles.title}>DITIRO DRONE</Text>
            <Text style={styles.subtitle}>Mobile Native Capture & Alert Layer</Text>
          </View>

          <TouchableOpacity style={styles.signOutHeaderButton} onPress={handleSignOut}>
            <Text style={styles.signOutHeaderButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Session Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ACCOUNT & CLOUD SESSION</Text>

          {userEmail ? (
            <View style={styles.sessionRow}>
              <Text style={styles.sessionLabel}>Connected Account:</Text>
              <Text style={styles.sessionValue}>{userEmail}</Text>
            </View>
          ) : null}

          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>Authenticated UID:</Text>
            <Text style={styles.sessionValue}>{userId ? `${userId.substring(0, 18)}...` : 'Connected'}</Text>
          </View>
        </View>

        {/* Global Controls Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SYSTEM CONTROLS</Text>

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
              <Text style={styles.rowTitle}>Silent Background Sync</Text>
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

          {/* Interval Control */}
          <Text style={styles.intervalHeader}>ALERT INTERVAL</Text>
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

          <TouchableOpacity
            style={{
              marginTop: SPACING.md,
              backgroundColor: COLORS.primaryAccent,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: 'center',
            }}
            onPress={async () => {
              try {
                await sendTestNotification();
              } catch (e) {
                console.error('Test notification error:', e);
              }
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
              🔔 Trigger Test Notification
            </Text>
          </TouchableOpacity>
        </View>

        {/* Real-time Task-Centric Alerts & Reminders */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>REAL-TIME WORKSPACE TASKS</Text>
            <Text style={styles.taskCount}>{tasks.filter((t) => t.remindersEnabled).length} Active</Text>
          </View>

          {tasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Workspace Tasks Found</Text>
              <Text style={styles.emptySubtitle}>
                Tasks created in your Ditiro Web account will automatically stream and sync to this device!
              </Text>
            </View>
          ) : (
            tasks.map((task) => (
              <View key={task.id} style={styles.taskItem}>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskMeta}>
                    Due: {task.dueDate} at {task.dueTime} • Every {task.alertFrequencyMinutes}m
                  </Text>
                </View>
                <Switch
                  value={task.remindersEnabled && settings.globalNotificationsEnabled}
                  disabled={!settings.globalNotificationsEnabled}
                  onValueChange={() => handleTaskReminderToggle(task.id, task.remindersEnabled)}
                  trackColor={{ false: '#383B42', true: COLORS.primaryAccent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))
          )}
        </View>

        {/* Future Extension: Hands-Free Voice Capture Slot */}
        <View style={styles.voiceCard}>
          <View style={styles.voiceIconPlaceholder}>
            <Text style={styles.voiceIconText}>🎙️</Text>
          </View>
          <View style={styles.voiceTextContainer}>
            <Text style={styles.voiceTitle}>Voice Evocation Engine</Text>
            <Text style={styles.voiceSubtitle}>"Hello Ditiro" hands-free task capture coming in future release.</Text>
          </View>
        </View>

        <Text style={styles.footerNote}>
          Token: {pushToken ? `${pushToken.substring(0, 22)}...` : 'Simulated Scout Environment'}
        </Text>
      </ScrollView>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    marginBottom: SPACING.xs,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  badgeText: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardTitle: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  taskCount: {
    color: COLORS.primaryAccent,
    fontSize: 12,
    fontWeight: '600',
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
    marginBottom: SPACING.sm,
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
  taskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#25272B',
  },
  taskInfo: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  taskTitle: {
    color: COLORS.softText,
    fontSize: 14,
    fontWeight: '500',
  },
  taskMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
    marginTop: 2,
  },
  voiceCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.85,
  },
  voiceIconPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryAccentAlpha,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  voiceIconText: {
    fontSize: 20,
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
});
