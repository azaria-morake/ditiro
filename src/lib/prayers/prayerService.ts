import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from 'adhan';
import { db, Task } from '@/lib/dexie';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

export interface PrayerCity {
  id: string;
  name: string;
  shortName: string;
  country: string;
  latitude: number;
  longitude: number;
}

export const SOUTH_AFRICAN_CITIES: PrayerCity[] = [
  { id: 'jhb', name: 'Johannesburg', shortName: 'JHB', country: 'South Africa', latitude: -26.2041, longitude: 28.0473 },
  { id: 'pta', name: 'Pretoria', shortName: 'PTA', country: 'South Africa', latitude: -25.7479, longitude: 28.2293 },
  { id: 'cpt', name: 'Cape Town', shortName: 'CPT', country: 'South Africa', latitude: -33.9249, longitude: 18.4241 },
  { id: 'dbn', name: 'Durban', shortName: 'DBN', country: 'South Africa', latitude: -29.8587, longitude: 31.0218 },
  { id: 'plz', name: 'Gqeberha / Port Elizabeth', shortName: 'PLZ', country: 'South Africa', latitude: -33.9608, longitude: 25.6022 },
  { id: 'bfn', name: 'Bloemfontein', shortName: 'BFN', country: 'South Africa', latitude: -29.0852, longitude: 26.1596 },
];

export interface PrayerTimeSlot {
  name: 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
  displayName: string;
  timeStr: string;
  dateObj: Date;
  icon: string;
  description: string;
}

export interface PrayerRoutineConfig {
  enabled: boolean;
  cityId: string;
  cityName: string;
  latitude: number;
  longitude: number;
  madhab: 'shafi' | 'hanafi';
  remindersEnabled: boolean;
  alertFrequencyMinutes: number;
  autoPruneExpired: boolean;
  lastGeneratedDate?: string;
  updatedAt: number;
}

export const DEFAULT_PRAYER_CONFIG: PrayerRoutineConfig = {
  enabled: true,
  cityId: 'jhb',
  cityName: 'Johannesburg (JHB)',
  latitude: -26.2041,
  longitude: 28.0473,
  madhab: 'shafi',
  remindersEnabled: true,
  alertFrequencyMinutes: 15,
  autoPruneExpired: true,
  updatedAt: Date.now(),
};

/**
 * High-precision offline calculation of Islamic prayer times using Adhan
 */
export function calculateDailyPrayers(
  coords: { latitude: number; longitude: number },
  date: Date = new Date(),
  madhab: 'shafi' | 'hanafi' = 'shafi'
): PrayerTimeSlot[] {
  const coordinates = new Coordinates(coords.latitude, coords.longitude);
  const params = CalculationMethod.MuslimWorldLeague();
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;

  const pt = new PrayerTimes(coordinates, date, params);

  const formatTime = (d: Date) => {
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  };

  return [
    { name: 'Fajr', displayName: 'Fajr Prayer', timeStr: formatTime(pt.fajr), dateObj: pt.fajr, icon: '🌅', description: 'Dawn Salah' },
    { name: 'Dhuhr', displayName: 'Dhuhr Prayer', timeStr: formatTime(pt.dhuhr), dateObj: pt.dhuhr, icon: '☀️', description: 'Midday Salah' },
    { name: 'Asr', displayName: 'Asr Prayer', timeStr: formatTime(pt.asr), dateObj: pt.asr, icon: '🌤️', description: 'Afternoon Salah' },
    { name: 'Maghrib', displayName: 'Maghrib Prayer', timeStr: formatTime(pt.maghrib), dateObj: pt.maghrib, icon: '🌇', description: 'Sunset Salah' },
    { name: 'Isha', displayName: 'Isha Prayer', timeStr: formatTime(pt.isha), dateObj: pt.isha, icon: '🌙', description: 'Night Salah' },
  ];
}

const STORAGE_KEY = 'ditiro_prayer_routine_config';

/**
 * Load prayer routine config from localStorage or Firestore
 */
export async function getPrayerRoutineConfig(userId: string): Promise<PrayerRoutineConfig | null> {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Failed to parse cached prayer config', e);
      }
    }
  }

  try {
    const snap = await getDoc(doc(firestore, 'users', userId, 'routines', 'prayer'));
    if (snap.exists()) {
      const data = snap.data() as PrayerRoutineConfig;
      if (typeof window !== 'undefined') {
        localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(data));
      }
      return data;
    }
  } catch (e) {
    console.error('Failed to fetch prayer routine config from Firestore', e);
  }

  return null;
}

/**
 * Save prayer routine config to localStorage and Firestore
 */
export async function savePrayerRoutineConfig(
  userId: string,
  config: PrayerRoutineConfig
): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(config));
  }

  try {
    await setDoc(doc(firestore, 'users', userId, 'routines', 'prayer'), config, { merge: true });
  } catch (e) {
    console.error('Failed to save prayer config to Firestore', e);
  }
}

/**
 * Generates today's 5 prayer deeds in Dexie if not already present
 */
export async function generatePrayerDeedsForToday(
  userId: string,
  config: PrayerRoutineConfig,
  targetDate: Date = new Date()
): Promise<{ added: number; prayerTasks: Task[] }> {
  if (!userId) return { added: 0, prayerTasks: [] };

  const todayStr = targetDate.toISOString().split('T')[0];
  const prayerSlots = calculateDailyPrayers(
    { latitude: config.latitude, longitude: config.longitude },
    targetDate,
    config.madhab
  );

  // Get existing tasks for this user on this date
  const existingUserTasks = await db.tasks
    .where('userId')
    .equals(userId)
    .toArray();

  const addedTasks: Task[] = [];

  for (const slot of prayerSlots) {
    // Check if deed already exists for this prayer today
    const exists = existingUserTasks.some(
      (t) =>
        t.dueDate === todayStr &&
        (t.title.toLowerCase().includes(slot.name.toLowerCase()) ||
          (t as any).category === 'prayer') &&
        t.title === slot.displayName
    );

    if (!exists) {
      const taskId = `prayer-${slot.name.toLowerCase()}-${todayStr}-${userId.slice(0, 6)}`;
      const newTask: Task = {
        id: taskId,
        title: slot.displayName,
        description: `${slot.description} · ${config.cityName}`,
        status: 'active',
        dueDate: todayStr,
        dueTime: slot.timeStr,
        location: config.cityName,
        remindersEnabled: config.remindersEnabled,
        alertFrequencyMinutes: config.alertFrequencyMinutes || 15,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        userId: userId,
      };

      // Add routine category metadata
      (newTask as any).category = 'prayer';
      (newTask as any).isRoutine = true;
      (newTask as any).routineType = 'islamic_prayer';

      await db.tasks.put(newTask);
      addedTasks.push(newTask);

      // Trigger Ditiro Drone Notification & Timer Subroutine for each deed
      import('@/lib/drone/reminderDispatcher').then(({ registerOrUpdateTaskSubroutine }) => {
        registerOrUpdateTaskSubroutine({
          id: taskId,
          title: slot.displayName,
          dueDate: todayStr,
          dueTime: slot.timeStr,
          userId,
          remindersEnabled: config.remindersEnabled,
          reminderIntervalMs: (config.alertFrequencyMinutes || 15) * 60 * 1000,
        });
      });
    }
  }

  // Update last generated date
  const updatedConfig = { ...config, lastGeneratedDate: todayStr, updatedAt: Date.now() };
  await savePrayerRoutineConfig(userId, updatedConfig);

  return { added: addedTasks.length, prayerTasks: addedTasks };
}

/**
 * 24-hour Auto-Cleanup: Prunes expired prayer deeds from yesterday or older
 */
export async function cleanupExpiredPrayerDeeds(userId: string): Promise<number> {
  if (!userId) return 0;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const userTasks = await db.tasks
      .where('userId')
      .equals(userId)
      .toArray();

    // Identify prayer deeds whose due date is older than today
    const expiredPrayers = userTasks.filter((t) => {
      const isPrayer = (t as any).category === 'prayer' || (t as any).isRoutine === true;
      return isPrayer && t.dueDate && t.dueDate < todayStr;
    });

    if (expiredPrayers.length > 0) {
      const expiredIds = expiredPrayers.map((t) => t.id);
      await db.tasks.bulkDelete(expiredIds);

      // Clean up Firestore documents as well
      for (const t of expiredPrayers) {
        try {
          await deleteDoc(doc(firestore, 'users', userId, 'tasks', t.id));
        } catch (err) {
          console.warn('Could not delete expired prayer doc from Firestore', t.id, err);
        }
      }

      console.log(`[PrayerService] Pruned ${expiredPrayers.length} expired daily prayer deeds.`);
      return expiredPrayers.length;
    }
  } catch (e) {
    console.error('Failed to cleanup expired prayer deeds', e);
  }

  return 0;
}

/**
 * Sync subroutine that runs daily: cleans up expired deeds, then ensures today's deeds exist
 */
export async function syncDailyPrayerRoutine(userId: string): Promise<void> {
  if (!userId) return;

  const config = await getPrayerRoutineConfig(userId);
  if (!config || !config.enabled) return;

  // 1. Cleanup expired prayer deeds from yesterday
  if (config.autoPruneExpired) {
    await cleanupExpiredPrayerDeeds(userId);
  }

  // 2. Generate today's 5 prayer deeds if not already done today
  const todayStr = new Date().toISOString().split('T')[0];
  if (config.lastGeneratedDate !== todayStr) {
    await generatePrayerDeedsForToday(userId, config);
  }
}
