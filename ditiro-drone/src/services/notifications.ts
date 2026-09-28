import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { updateDronePushToken, TaskReminder, getDroneSettings, fetchUserTasksOnce } from './droneSync';

export const BACKGROUND_NOTIFICATION_TASK = 'DITIRO_SILENT_SYNC_TASK';
export const BACKGROUND_FETCH_TASK = 'DITIRO_BACKGROUND_FETCH_TASK';

// Configure notification behavior for foreground delivery
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
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

// Define background notification task (handles silent FCM data payloads)
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }: { data?: any; error?: any }) => {
  if (error) {
    console.error('[Drone TaskManager Error]:', error);
    return;
  }
  if (data) {
    const payload = data as any;
    console.log('[Drone Background Sync Received Payload]:', payload);

    await ensureNotificationChannel();

    // 1. Trigger local notification to tray when background payload or task reminder arrives
    if (payload.title || payload.body) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title || '🛸 Ditiro Task Alert',
          body: payload.body || payload.message || 'Workspace task status updated and synchronized.',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: payload.data || {},
        },
        trigger: Platform.OS === 'android' ? ({ channelId: 'ditiro_alerts' } as any) : null,
      });
      console.log('[Drone Silent Sync Execution]: Tray notification triggered for background payload.');
    }

    // 2. Headless background re-sync of Firestore tasks & alert re-arming
    try {
      const userId = await AsyncStorage.getItem('@ditiro_active_uid');
      if (userId) {
        const settings = await getDroneSettings(userId);
        if (settings.silentSyncEnabled) {
          const tasks = await fetchUserTasksOnce(userId);
          await scheduleTaskNotifications(tasks, settings.globalNotificationsEnabled);
          console.log(`[Drone Background Sync]: Successfully refreshed and re-armed ${tasks.length} tasks.`);
        }
      }
    } catch (syncErr) {
      console.error('[Drone Background Sync] Task re-arm failed:', syncErr);
    }
  }
});

// Define periodic background fetch task (OS wake-up trigger every ~15m)
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const userId = await AsyncStorage.getItem('@ditiro_active_uid');
    if (!userId) {
      console.log('[Drone Background Fetch]: No authenticated user cached in storage.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const settings = await getDroneSettings(userId);
    if (!settings.silentSyncEnabled) {
      console.log('[Drone Background Fetch]: Silent background sync disabled by user.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log('[Drone Background Fetch]: Checking and synchronizing workspace tasks for user:', userId);
    const tasks = await fetchUserTasksOnce(userId);
    await scheduleTaskNotifications(tasks, settings.globalNotificationsEnabled);
    console.log(`[Drone Background Fetch]: Successfully refreshed ${tasks.length} tasks and armed native alerts.`);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error('[Drone Background Fetch Error]:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  let token: string | null = null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Ditiro Drone]: Permission to receive notifications was denied.');
      return null;
    }
  } catch (permErr) {
    console.warn('[Ditiro Drone]: Error requesting notification permissions:', permErr);
  }

  await ensureNotificationChannel();

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

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const pushTokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    ).catch((err: unknown) => {
      console.warn('[Ditiro Drone]: Push token generation skipped or unavailable:', (err as Error)?.message || err);
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

export async function unregisterBackgroundSyncTasks() {
  try {
    const isFetchRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (isFetchRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      console.log('[Drone TaskManager]: Background fetch task unregistered.');
    }
  } catch (err) {
    console.warn('[Drone TaskManager Unregister Failed]:', err);
  }
}

export function parseTaskDueDate(dueDate?: string, dueTime?: string): Date | null {
  try {
    if (!dueDate && !dueTime) return null;

    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();

    if (dueDate) {
      const lower = dueDate.trim().toLowerCase();
      if (lower === 'today') {
        // Today
      } else if (lower === 'tomorrow') {
        day += 1;
      } else if (dueDate.includes('-')) {
        const dateParts = dueDate.split('-');
        if (dateParts.length === 3) {
          year = parseInt(dateParts[0], 10);
          month = parseInt(dateParts[1], 10) - 1;
          day = parseInt(dateParts[2], 10);
        }
      } else {
        const parsed = new Date(dueDate);
        if (!isNaN(parsed.getTime())) {
          year = parsed.getFullYear();
          month = parsed.getMonth();
          day = parsed.getDate();
        }
      }
    }

    let hours = 23;
    let minutes = 59;

    if (dueTime) {
      const lowerTime = dueTime.trim().toLowerCase();
      const isPM = lowerTime.includes('pm');
      const isAM = lowerTime.includes('am');
      const cleanTime = lowerTime.replace(/[^\d:]/g, '');
      const timeParts = cleanTime.split(':');
      if (timeParts.length >= 2) {
        let rawHours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
        if (isPM && rawHours < 12) {
          rawHours += 12;
        } else if (isAM && rawHours === 12) {
          rawHours = 0;
        }
        hours = rawHours;
      }
    }

    const targetDate = new Date(year, month, day, hours, minutes, 0, 0);
    return isNaN(targetDate.getTime()) ? null : targetDate;
  } catch (err) {
    return null;
  }
}

export function isTaskOverdue(dueDate?: string, dueTime?: string): boolean {
  const targetDate = parseTaskDueDate(dueDate, dueTime);
  if (!targetDate) return false;
  return targetDate.getTime() < Date.now();
}

/**
 * Schedule local notifications to the device tray for all active, upcoming workspace tasks.
 * Overdue or completed tasks are excluded to prevent notification storms on app load.
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

    const now = Date.now();

    // Filter to tasks that are active, have reminders enabled, AND are not in the past
    const upcomingTasks = tasks.filter((t) => {
      if (t.status !== 'active' || !t.remindersEnabled) return false;
      const targetDate = parseTaskDueDate(t.dueDate, t.dueTime);
      // If task due date is in the past, skip it so old tasks don't buzz the phone
      if (targetDate && targetDate.getTime() <= now) {
        return false;
      }
      return true;
    });

    console.log(
      `[Ditiro Drone]: Scheduling notifications for ${upcomingTasks.length} upcoming tasks (skipped ${tasks.length - upcomingTasks.length} past-due/inactive tasks).`
    );

    for (const task of upcomingTasks) {
      const targetDate = parseTaskDueDate(task.dueDate, task.dueTime);
      if (!targetDate) continue;

      const intervalMins = task.alertFrequencyMinutes || 15;
      const leadTimeDate = new Date(targetDate.getTime() - intervalMins * 60 * 1000);

      // 1. Pre-due Interval Alert (fires X minutes before task is due, e.g. at 15:15 for a 15:30 task)
      if (leadTimeDate.getTime() > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: `ditiro-interval-${task.id}`,
          content: {
            title: '🛸 Upcoming Deed Reminder',
            body: `"${task.title}" is due in ${intervalMins} mins (${task.dueTime || ''})`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
            data: { taskId: task.id, type: 'UPCOMING_INTERVAL', minutes: intervalMins },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: leadTimeDate,
            channelId: 'ditiro_alerts',
          },
        });
        console.log(`[Ditiro Drone]: Scheduled ${intervalMins}m lead-time alert for "${task.title}" at ${leadTimeDate.toLocaleTimeString()}`);
      }

      // 2. Exact Due Time Alert (fires at the due time, e.g. at 15:30)
      if (targetDate.getTime() > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: `ditiro-due-${task.id}`,
          content: {
            title: '🛸 Ditiro Task Due',
            body: `Deed Due: "${task.title}" (${task.dueTime || task.dueDate || ''})`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
            data: { taskId: task.id, type: 'DUE_NOW' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: targetDate,
            channelId: 'ditiro_alerts',
          },
        });
        console.log(`[Ditiro Drone]: Scheduled due-time alert for "${task.title}" at ${targetDate.toLocaleTimeString()}`);
      }
    }

    const scheduledList = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[Ditiro Drone]: Active scheduled triggers in OS: ${scheduledList.length}`);
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

/**
 * Schedule a one-off custom alert for an exact date and time
 */
export async function scheduleCustomExactNotification(
  title: string,
  targetDate: Date,
  body?: string
): Promise<string | null> {
  try {
    await ensureNotificationChannel();
    const id = await Notifications.scheduleNotificationAsync({
      identifier: `ditiro-custom-${Date.now()}`,
      content: {
        title: title || '🛸 Ditiro Scheduled Alert',
        body:
          body ||
          `Custom alert for ${targetDate.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          })} at ${targetDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { type: 'CUSTOM_EXACT' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: targetDate,
        channelId: 'ditiro_alerts',
      },
    });
    console.log(`[Ditiro Drone]: Scheduled custom alert at ${targetDate.toISOString()} with ID: ${id}`);
    return id;
  } catch (err) {
    console.error('[Ditiro Drone]: Error scheduling custom alert:', err);
    return null;
  }
}

