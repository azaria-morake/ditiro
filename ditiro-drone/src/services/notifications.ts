import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { updateDronePushToken, TaskReminder } from './droneSync';

export const BACKGROUND_NOTIFICATION_TASK = 'DITIRO_SILENT_SYNC_TASK';
export const BACKGROUND_FETCH_TASK = 'DITIRO_BACKGROUND_FETCH_TASK';

// Configure notification behavior for foreground delivery
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Helper to ensure Android notification channel exists
export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('ditiro_alerts', {
      name: 'Ditiro Task Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D48C2B',
      sound: 'default',
    });
  }
}

// Define background notification task
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }: { data?: any; error?: any }) => {
  if (error) {
    console.error('[Drone TaskManager Error]:', error);
    return;
  }
  if (data) {
    const payload = data as any;
    console.log('[Drone Background Sync Received Payload]:', payload);

    await ensureNotificationChannel();

    // Trigger local notification to tray when background payload or task reminder arrives
    if (payload.type === 'SILENT_SYNC' || payload.type === 'TASK_REMINDER' || payload.title) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title || '🛸 Ditiro Task Alert',
          body: payload.body || payload.message || 'Workspace task status updated and synchronized.',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: payload.data || {},
        },
        trigger: Platform.OS === 'android' ? { channelId: 'ditiro_alerts' } as any : null,
      });
      console.log('[Drone Silent Sync Execution]: Tray notification triggered for background payload.');
    }
  }
});

// Define periodic background fetch task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('[Drone Background Fetch]: Checking for pending task alerts...');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error('[Drone Background Fetch Error]:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  let token: string | null = null;

  if (!Device.isDevice) {
    console.warn('[Ditiro Drone]: Push notifications require a physical device.');
    return null;
  }

  // In Expo SDK 53+, remote push notifications via expo-notifications are not supported inside Expo Go
  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    (Constants as any).appOwnership === 'expo';

  if (isExpoGo) {
    console.log('[Ditiro Drone]: Running in Expo Go client. Remote FCM push tokens require a Development Build or standalone APK.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Ditiro Drone]: Permission to receive push notifications was denied.');
    return null;
  }

  try {
    const pushTokenData = await Notifications.getExpoPushTokenAsync().catch((err) => {
      console.warn('[Ditiro Drone]: Push token generation skipped or unavailable.');
      return null;
    });
    if (pushTokenData) {
      token = pushTokenData.data;
      console.log('[Ditiro Drone Push Token]:', token);

      if (userId && token) {
        await updateDronePushToken(userId, token);
      }
    }
  } catch (error) {
    console.warn('[Ditiro Drone Push Token Notice]:', (error as Error).message || error);
  }

  await ensureNotificationChannel();

  return token;
}

export async function setupBackgroundSyncTasks() {
  try {
    const isFetchRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (!isFetchRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('[Drone TaskManager]: Background fetch task registered.');
    }
  } catch (err) {
    console.error('[Drone TaskManager Register Failed]:', err);
  }
}

export function parseTaskDueDate(dueDate?: string, dueTime?: string): Date | null {
  try {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();

    if (dueDate && dueDate !== 'Today') {
      const dateParts = dueDate.split('-');
      if (dateParts.length === 3) {
        year = parseInt(dateParts[0], 10);
        month = parseInt(dateParts[1], 10) - 1;
        day = parseInt(dateParts[2], 10);
      }
    }

    let hours = 12;
    let minutes = 0;

    if (dueTime) {
      const timeParts = dueTime.split(':');
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
      }
    }

    const targetDate = new Date(year, month, day, hours, minutes, 0, 0);
    return isNaN(targetDate.getTime()) ? null : targetDate;
  } catch (err) {
    return null;
  }
}

/**
 * Schedule local notifications to the device tray for all active workspace tasks
 */
export async function scheduleTaskNotifications(
  tasks: TaskReminder[],
  globalEnabled: boolean
): Promise<void> {
  try {
    await ensureNotificationChannel();

    // Cancel all previously scheduled task notifications before re-scheduling
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!globalEnabled) {
      console.log('[Ditiro Drone]: Global notifications are disabled. Cleared all scheduled notifications.');
      return;
    }

    const activeReminders = tasks.filter((t) => t.status === 'active' && t.remindersEnabled);
    console.log(`[Ditiro Drone]: Scheduling local notifications for ${activeReminders.length} active tasks.`);

    for (const task of activeReminders) {
      const intervalSecs = Math.max(60, (task.alertFrequencyMinutes || 15) * 60);

      // 1. Recurring Interval Trigger
      await Notifications.scheduleNotificationAsync({
        identifier: `ditiro-interval-${task.id}`,
        content: {
          title: '🛸 Ditiro Task Alert',
          body: `Pending Deed: "${task.title}" (Every ${task.alertFrequencyMinutes || 15}m)`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { taskId: task.id, type: 'INTERVAL' },
        },
        trigger: {
          seconds: intervalSecs,
          repeats: true,
          channelId: 'ditiro_alerts',
        } as any,
      });

      // 2. Scheduled Target Due Date/Time Trigger
      const targetDate = parseTaskDueDate(task.dueDate, task.dueTime);
      if (targetDate && targetDate.getTime() > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          identifier: `ditiro-due-${task.id}`,
          content: {
            title: '🛸 Ditiro Task Due Now',
            body: `Scheduled Time Reached: "${task.title}" (Due: ${task.dueTime || ''})`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
            data: { taskId: task.id, type: 'DUE_NOW' },
          },
          trigger: {
            date: targetDate,
            channelId: 'ditiro_alerts',
          } as any,
        });
        console.log(`[Ditiro Drone]: Scheduled due time alert for "${task.title}" at ${targetDate.toLocaleString()}`);
      }
    }

    const scheduledList = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[Ditiro Drone]: Total active triggers in OS notification manager: ${scheduledList.length}`);
  } catch (err) {
    console.error('[Ditiro Drone]: Error scheduling task notifications:', err);
  }
}

export async function sendTestNotification(): Promise<void> {
  await ensureNotificationChannel();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🛸 Ditiro Task Alert',
      body: 'Scout notification active! Workspace tasks are synchronized with your mobile tray.',
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: null, // deliver immediately
  });
}

