import { firestore } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Ditiro Drone - Task-Centric Timer Subroutine & FCM Payload Dispatcher
 */

export interface TaskData {
  id: string;
  userId: string;
  title: string;
  dueDate?: string;
  dueTime?: string;
  remindersEnabled: boolean;
  reminderIntervalMs?: number; // e.g., 1800000 for 30 mins
  userFcmToken?: string;
}

export class TaskSubroutine {
  public data: TaskData;
  private timerHandle?: ReturnType<typeof setTimeout>;

  constructor(data: TaskData) {
    this.data = data;
    if (this.data.remindersEnabled && this.data.reminderIntervalMs) {
      this.scheduleReminderSubroutine();
    }
  }

  /**
   * Task-centric timer subroutine for recurring or initial alerts
   */
  public scheduleReminderSubroutine(): void {
    if (this.timerHandle) clearTimeout(this.timerHandle);

    const interval = this.data.reminderIntervalMs || 30 * 60 * 1000;

    this.timerHandle = setTimeout(async () => {
      await this.sendNotificationAlert();
      // Re-arm for recurring interval if task reminders remain enabled
      if (this.data.remindersEnabled) {
        this.scheduleReminderSubroutine();
      }
    }, interval);
  }

  /**
   * Toggle subroutine for user / task reminder settings
   */
  public toggleReminders(enabled: boolean): void {
    this.data.remindersEnabled = enabled;
    if (!enabled && this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = undefined;
      console.log(`[Ditiro Drone] Reminders disabled & timer cleared for Task ${this.data.id}`);
    } else if (enabled && this.data.reminderIntervalMs) {
      this.scheduleReminderSubroutine();
      console.log(`[Ditiro Drone] Reminders enabled & timer scheduled for Task ${this.data.id}`);
    }
  }

  /**
   * Dispatch FCM / Expo alert to mobile client
   */
  public async sendNotificationAlert(): Promise<boolean> {
    if (!this.data.userId) return false;

    let token = this.data.userFcmToken;

    if (!token) {
      try {
        const settingsDoc = await getDoc(doc(firestore, 'users', this.data.userId, 'drone', 'settings'));
        if (settingsDoc.exists()) {
          const droneSettings = settingsDoc.data();
          if (!droneSettings.globalNotificationsEnabled) {
            console.log(`[Ditiro Drone] Global notifications disabled by user ${this.data.userId}`);
            return false;
          }
          token = droneSettings.pushToken;
        }
      } catch (err) {
        console.error('[Ditiro Drone] Error fetching push token:', err);
      }
    }

    if (!token) {
      console.warn(`[Ditiro Drone] No FCM push token registered for user ${this.data.userId}`);
      return false;
    }

    const payload = {
      to: token,
      sound: 'default',
      title: 'Ditiro Drone Alert 🛸',
      body: `Deed Pending: ${this.data.title}${this.data.dueDate ? ' (' + this.data.dueDate + ')' : ''}`,
      data: {
        taskId: this.data.id,
        action: 'SILENT_SYNC',
        type: 'TASK_REMINDER',
      },
      priority: 'high',
      channelId: 'ditiro_alerts',
      _displayInForeground: true,
    };

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();
      const success = resData?.data?.status === 'ok';
      if (success) {
        console.log(`[Ditiro Drone] Alert dispatched successfully for Task ${this.data.id}`);
      }
      return success;
    } catch (error) {
      console.error(`[Ditiro Drone] Notification dispatch failed for Task ${this.data.id}:`, error);
      return false;
    }
  }
}

/**
 * Registry map for active in-memory task timer subroutines
 */
const activeTaskSubroutines = new Map<string, TaskSubroutine>();

export function registerOrUpdateTaskSubroutine(data: TaskData): TaskSubroutine {
  let subroutine = activeTaskSubroutines.get(data.id);
  if (subroutine) {
    subroutine.toggleReminders(data.remindersEnabled);
    subroutine.data = { ...subroutine.data, ...data };
  } else {
    subroutine = new TaskSubroutine(data);
    activeTaskSubroutines.set(data.id, subroutine);
  }
  return subroutine;
}

export function toggleTaskSubroutine(taskId: string, enabled: boolean): void {
  const subroutine = activeTaskSubroutines.get(taskId);
  if (subroutine) {
    subroutine.toggleReminders(enabled);
  }
}


