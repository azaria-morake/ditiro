import { doc, getDoc, getDocs, setDoc, updateDoc, collection, onSnapshot, query } from 'firebase/firestore';
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

/**
 * One-off task fetch with client-side decryption for background sync workers
 */
export async function fetchUserTasksOnce(userId: string): Promise<TaskReminder[]> {
  try {
    const tasksRef = collection(firestore, 'users', userId, 'tasks');
    const snap = await getDocs(query(tasksRef));
    const fetchedTasks: TaskReminder[] = [];

    snap.forEach((docSnap) => {
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

    return fetchedTasks;
  } catch (err) {
    console.error('[DroneSync] Error fetching tasks once:', err);
    return [];
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

export async function toggleTaskStatus(
  userId: string,
  taskId: string,
  currentStatus: 'active' | 'completed'
): Promise<'active' | 'completed'> {
  const nextStatus = currentStatus === 'completed' ? 'active' : 'completed';
  try {
    const taskRef = doc(firestore, 'users', userId, 'tasks', taskId);
    const snap = await getDoc(taskRef);

    if (snap.exists()) {
      const rawData = snap.data();
      if (rawData.encryptedData) {
        const decrypted = decryptData(rawData.encryptedData, userId) || {};
        const updatedTask = {
          ...decrypted,
          status: nextStatus,
          // When completing task, disable reminders so it ceases firing alerts
          remindersEnabled: nextStatus === 'active',
          updatedAt: Date.now(),
        };
        const newEncrypted = encryptData(updatedTask, userId);
        await setDoc(taskRef, {
          encryptedData: newEncrypted,
          status: nextStatus,
          remindersEnabled: nextStatus === 'active',
          updatedAt: Date.now(),
        }, { merge: true });
        return nextStatus;
      }
    }

    await updateDoc(taskRef, {
      status: nextStatus,
      remindersEnabled: nextStatus === 'active',
      updatedAt: Date.now(),
    });
    return nextStatus;
  } catch (error) {
    console.error('[DroneSync] Error toggling task status:', error);
    return currentStatus;
  }
}

export async function updateDroneTask(
  userId: string,
  taskId: string,
  updates: {
    title?: string;
    dueDate?: string;
    dueTime?: string;
    alertFrequencyMinutes?: number;
    remindersEnabled?: boolean;
    status?: 'active' | 'completed';
    priority?: 'high' | 'medium' | 'low';
  }
): Promise<boolean> {
  try {
    const taskRef = doc(firestore, 'users', userId, 'tasks', taskId);
    const snap = await getDoc(taskRef);
    const now = Date.now();

    if (snap.exists()) {
      const rawData = snap.data();
      let decrypted: any = {};
      if (rawData.encryptedData) {
        decrypted = decryptData(rawData.encryptedData, userId) || {};
      } else {
        decrypted = { ...rawData };
      }

      const mergedTask = {
        ...decrypted,
        ...updates,
        updatedAt: now,
      };

      const newEncrypted = encryptData(mergedTask, userId);
      await setDoc(
        taskRef,
        {
          ...updates,
          encryptedData: newEncrypted,
          updatedAt: now,
        },
        { merge: true }
      );
      return true;
    }

    return false;
  } catch (error) {
    console.error('[DroneSync] Error updating drone task:', error);
    return false;
  }
}

export async function createDroneTask(
  userId: string,
  title: string,
  dueDate: string = 'Today',
  dueTime: string = '23:59',
  alertFrequencyMinutes: number = 15
): Promise<TaskReminder | null> {
  try {
    const taskId = 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    let resolvedDueDate = dueDate;
    if (!dueDate || dueDate === 'Today') {
      resolvedDueDate = `${year}-${month}-${day}`;
    } else if (dueDate === 'Tomorrow') {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tYear = tomorrow.getFullYear();
      const tMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const tDay = String(tomorrow.getDate()).padStart(2, '0');
      resolvedDueDate = `${tYear}-${tMonth}-${tDay}`;
    }

    const resolvedDueTime = dueTime || '23:59';

    const newTask = {
      id: taskId,
      title: title.trim(),
      status: 'active' as const,
      dueDate: resolvedDueDate,
      dueTime: resolvedDueTime,
      remindersEnabled: true,
      alertFrequencyMinutes: alertFrequencyMinutes || 15,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId,
    };

    const encrypted = encryptData(newTask, userId);
    await setDoc(doc(firestore, 'users', userId, 'tasks', taskId), {
      encryptedData: encrypted,
      updatedAt: Date.now(),
    });

    return {
      id: taskId,
      title: newTask.title,
      dueDate: newTask.dueDate,
      dueTime: newTask.dueTime,
      remindersEnabled: newTask.remindersEnabled,
      alertFrequencyMinutes: newTask.alertFrequencyMinutes,
      status: newTask.status,
    };
  } catch (error) {
    console.error('[DroneSync] Error creating drone task:', error);
    return null;
  }
}

export async function deleteDroneTask(userId: string, taskId: string): Promise<boolean> {
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(firestore, 'users', userId, 'tasks', taskId));
    return true;
  } catch (error) {
    console.error('[DroneSync] Error deleting drone task:', error);
    return false;
  }
}

