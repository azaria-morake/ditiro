import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, query } from 'firebase/firestore';
import { firestore } from './firebase';
import { decryptData, encryptData } from './encryption';

export interface DroneSettings {
  globalNotificationsEnabled: boolean;
  alertIntervalMinutes: number; // Granular interval control (e.g. 15, 30, 60 mins)
  silentSyncEnabled: boolean;
  pushToken?: string;
  updatedAt: number;
}

export interface TaskReminder {
  id: string;
  title: string;
  dueDate?: string;
  dueTime?: string;
  remindersEnabled: boolean;
  alertFrequencyMinutes: number;
  status: 'active' | 'completed';
}

const DEFAULT_SETTINGS: DroneSettings = {
  globalNotificationsEnabled: true,
  alertIntervalMinutes: 30,
  silentSyncEnabled: true,
  updatedAt: Date.now(),
};

export async function getDroneSettings(userId: string): Promise<DroneSettings> {
  try {
    const docRef = doc(firestore, 'users', userId, 'drone', 'settings');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as DroneSettings;
    }
    await setDoc(docRef, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('[DroneSync] Error getting drone settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function updateDroneSettings(userId: string, settings: Partial<DroneSettings>): Promise<void> {
  try {
    const docRef = doc(firestore, 'users', userId, 'drone', 'settings');
    await setDoc(docRef, { ...settings, updatedAt: Date.now() }, { merge: true });
  } catch (error) {
    console.error('[DroneSync] Error updating drone settings:', error);
  }
}

export async function updateDronePushToken(userId: string, token: string): Promise<void> {
  try {
    const docRef = doc(firestore, 'users', userId, 'drone', 'settings');
    await setDoc(docRef, { pushToken: token, updatedAt: Date.now() }, { merge: true });
  } catch (error) {
    console.error('[DroneSync] Error updating push token:', error);
  }
}

/**
 * Real-time subscription to user's real Firestore tasks with decryption support
 */
export function subscribeUserTasks(
  userId: string,
  onTasksUpdated: (tasks: TaskReminder[]) => void
): () => void {
  try {
    const tasksRef = collection(firestore, 'users', userId, 'tasks');
    const q = query(tasksRef);

    return onSnapshot(
      q,
      (snapshot) => {
        const fetchedTasks: TaskReminder[] = [];

        snapshot.forEach((docSnap) => {
          const rawData = docSnap.data();
          let taskObj = rawData;

          if (rawData.encryptedData) {
            const decrypted = decryptData(rawData.encryptedData, userId);
            if (decrypted) {
              taskObj = { ...rawData, ...decrypted };
            }
          }

          fetchedTasks.push({
            id: docSnap.id,
            title: taskObj.title || taskObj.text || 'Untitled Task',
            dueDate: taskObj.dueDate || taskObj.date || 'Today',
            dueTime: taskObj.dueTime || taskObj.time || '12:00',
            remindersEnabled: taskObj.remindersEnabled !== false,
            alertFrequencyMinutes: taskObj.alertFrequencyMinutes || taskObj.reminderIntervalMinutes || 15,
            status: taskObj.completed || taskObj.status === 'completed' ? 'completed' : 'active',
          });
        });

        onTasksUpdated(fetchedTasks);
      },
      (error) => {
        console.error('[DroneSync] Task snapshot error:', error);
        onTasksUpdated([]);
      }
    );
  } catch (err) {
    console.error('[DroneSync] Error setting up task listener:', err);
    return () => {};
  }
}

export async function updateTaskReminderToggle(
  userId: string,
  taskId: string,
  remindersEnabled: boolean,
  alertFrequencyMinutes?: number
): Promise<void> {
  try {
    const taskRef = doc(firestore, 'users', userId, 'tasks', taskId);
    const snap = await getDoc(taskRef);

    if (snap.exists()) {
      const rawData = snap.data();
      if (rawData.encryptedData) {
        const decrypted = decryptData(rawData.encryptedData, userId) || {};
        const updatedTask = {
          ...decrypted,
          remindersEnabled,
          alertFrequencyMinutes: alertFrequencyMinutes || decrypted.alertFrequencyMinutes || 30,
          updatedAt: Date.now(),
        };
        const newEncrypted = encryptData(updatedTask, userId);
        await setDoc(taskRef, { encryptedData: newEncrypted, updatedAt: Date.now() }, { merge: true });
        return;
      }
    }

    await updateDoc(taskRef, {
      remindersEnabled,
      alertFrequencyMinutes: alertFrequencyMinutes || 30,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('[DroneSync] Error toggling task reminder:', error);
  }
}
