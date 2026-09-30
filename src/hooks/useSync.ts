"use client";

import { useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  writeBatch
} from 'firebase/firestore';
import { firestore, auth } from '@/lib/firebase';
import { db } from '@/lib/dexie';
import { useAuth } from '@/components/auth/AuthProvider';
import { encryptData, decryptData } from '@/lib/encryption';

// Copy identity hashing for use in sync
const hashTaskIdentity = (title: string, date?: string | null, chatId?: string | null) => {
    const cleanTitle = title.trim().toLowerCase();
    const cleanDate = date?.split(' ')[0] || 'nodate'; 
    const cleanChat = chatId || 'none';
    const raw = `${cleanTitle}|${cleanDate}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
    }
    return `t-${Math.abs(hash).toString(36)}-${cleanChat.slice(0, 4)}`;
};

const sanitizeForFirestore = (obj: any) => {
  const sanitized = { ...obj };
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    }
  });
  return sanitized;
};

export const useSync = () => {
  const { user, loading } = useAuth();
  const isInitialSync = useRef(true);

  useEffect(() => {
    if (loading || !user) return;

    const collections = ['chats', 'messages', 'tasks', 'subtasks'] as const;
    const uid = user.uid;

    const migrateData = async () => {
      try {
        let migratedCount = 0;
        for (const col of collections) {
          const allDocs = await db.table(col).toArray();
          const targetDocs = allDocs.filter(d => !d.userId || d.userId === "" || d.userId === uid);
          
          if (targetDocs.length > 0) {
            const batch = writeBatch(firestore);
            for (const docData of targetDocs) {
              const docId = docData.id;
              if (!docId) continue;
              const docRef = doc(firestore, 'users', uid, col, docId);
              const updatedDoc = { ...docData, userId: uid, updatedAt: docData.updatedAt || Date.now() };
              const sanitized = sanitizeForFirestore(updatedDoc);
              batch.set(docRef, {
                encryptedData: encryptData(sanitized, uid),
                updatedAt: sanitized.updatedAt
              }, { merge: true });
              if (!docData.userId || docData.userId === "") {
                await db.table(col).put(updatedDoc);
              }
              migratedCount++;
            }
            await batch.commit();
          }
        }
        if (migratedCount > 0) {
          localStorage.removeItem('ditiro_guest');
        }
        
        // Final pass: clean up duplicates after migration/sync
        await deduplicateTasks(uid);

        // Daily Routine: Prune expired past prayers and ensure today's 5 prayer deeds exist
        import('@/lib/prayers/prayerService').then(({ syncDailyPrayerRoutine }) => {
          syncDailyPrayerRoutine(uid);
        });
      } catch (err) {
        console.error("[useSync] Migration error:", err);
      }
    };

    if (isInitialSync.current) {
        migrateData();
        isInitialSync.current = false;
    }

    const hooks = collections.map(col => {
      const table = db.table(col);
      const onCreate = (id: any, obj: any) => {
        const currentUser = auth.currentUser;
        const currentUid = currentUser?.uid || uid;
        if (!currentUid) return;
        if (!obj.userId) obj.userId = currentUid;
        const docId = id || obj?.id;
        if (!docId) {
          console.warn(`[useSync] onCreate called without docId for ${col}`, obj);
          return;
        }
        const sanitized = sanitizeForFirestore(obj);
        setDoc(doc(firestore, 'users', currentUid, col, docId), {
          encryptedData: encryptData(sanitized, currentUid),
          updatedAt: sanitized.updatedAt || Date.now()
        }).catch(err => {
          console.error(`[useSync] Firestore write error for ${col}:${docId}`, err);
        });
        // Note: Dexie creating hook must return undefined unless intentionally overriding primary key
      };
      const onUpdate = (mods: any, id: any, obj: any) => {
        const currentUser = auth.currentUser;
        const currentUid = currentUser?.uid || uid;
        if (!currentUid) return;
        const docId = id || obj?.id || mods?.id;
        if (!docId) return;
        console.log(`[useSync] Outbound update for ${col}:${docId}`, mods);
        const merged = { ...obj, ...mods, userId: currentUid };
        const sanitized = sanitizeForFirestore(merged);
        setDoc(doc(firestore, 'users', currentUid, col, docId), {
          encryptedData: encryptData(sanitized, currentUid),
          updatedAt: sanitized.updatedAt || Date.now()
        }).catch(err => {
          console.error(`[useSync] Firestore update error for ${col}:${docId}`, err);
        });
      };
      const onDelete = (id: any, obj: any) => {
        const currentUser = auth.currentUser;
        const currentUid = currentUser?.uid || uid;
        if (!currentUid) return;
        const docId = id || obj?.id;
        if (!docId) return;
        deleteDoc(doc(firestore, 'users', currentUid, col, docId)).catch(err => {
          console.error(`[useSync] Firestore delete error for ${col}:${docId}`, err);
        });
      };

      table.hook('creating', onCreate);
      table.hook('updating', onUpdate);
      table.hook('deleting', onDelete);

      return () => {
        table.hook('creating').unsubscribe(onCreate);
        table.hook('updating').unsubscribe(onUpdate);
        table.hook('deleting').unsubscribe(onDelete);
      };
    });

    const unsubscribes = collections.map(col => {
      const q = query(collection(firestore, 'users', uid, col));
      return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          let data = change.doc.data();
          const id = change.doc.id;
          
          if (data.encryptedData) {
            const decrypted = decryptData(data.encryptedData, uid);
            if (decrypted) {
              data = { ...data, ...decrypted };
            }
          }

          if (change.type === 'added' || change.type === 'modified') {
            const local = await db.table(col).get(id);
            
            let shouldUpdate = !local || (data.updatedAt > (local.updatedAt || 0));

            // Special case for messages with proposals: don't let a remote sync revert an accepted task
            if (col === 'messages' && local && local.proposalData && data.proposalData) {
              const localAccepted = local.proposalData.acceptedIndices?.length || 0;
              const remoteAccepted = data.proposalData.acceptedIndices?.length || 0;
              if (localAccepted > remoteAccepted && (data.updatedAt <= local.updatedAt)) {
                shouldUpdate = false;
              }
            }

            if (shouldUpdate) {
                console.log(`[useSync] Inbound ${change.type} for ${col}:${id}. Updating local.`);
                await db.table(col).put({ ...data, id });
            } else {
                console.log(`[useSync] Inbound ${change.type} for ${col}:${id} skipped (Local is newer or more complete).`);
            }
          } else if (change.type === 'removed') {
            console.log(`[useSync] Inbound removal for ${col}:${id}`);
            await db.table(col).delete(id);
          }
        });
      }, (err) => {
        console.error(`[useSync] Snapshot error for ${col}:`, err);
      });
    });

    return () => {
      hooks.forEach(unsub => unsub());
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, loading]);

  const deduplicateTasks = async (uid: string) => {
    try {
      const allTasks = await db.tasks.where('userId').equals(uid).toArray();
      const seen = new Map<string, string>(); // 'title|chatId' -> 'primaryId'
      const toDelete: string[] = [];

      for (const t of allTasks) {
          const targetId = hashTaskIdentity(t.title, t.dueDate, t.chatId);
          
          if (t.id !== targetId) {
              console.log(`[useSync] Migrating task "${t.title}" to stable ID: ${targetId}`);
              const existing = await db.tasks.get(targetId);
              
              if (existing) {
                  // Merge: targetId already exists. Just remove this one.
                  toDelete.push(t.id);
              } else {
                  // Rename: targetId is free. Move data.
                  const newTask = { ...t, id: targetId, updatedAt: Date.now() };
                  await db.tasks.add(newTask);
                  // Move subtasks
                  const subs = await db.subtasks.where('taskId').equals(t.id).toArray();
                  for (const s of subs) {
                      await db.subtasks.update(s.id, { taskId: targetId });
                  }
                  toDelete.push(t.id);
              }
          } else {
              // Same ID, but check if we've seen this logical key before (to catch actual duplicates)
              const key = `${t.title.trim().toLowerCase()}|${t.dueDate || 'nodate'}|${t.chatId || 'none'}`;
              if (seen.has(key)) {
                  toDelete.push(t.id);
              } else {
                  seen.set(key, t.id);
              }
          }
      }

      if (toDelete.length > 0) {
          console.log(`[useSync] Cleaning up ${toDelete.length} logical duplicates...`);
          await db.tasks.bulkDelete(toDelete);
          // Also delete subtasks for these IDs
          for (const id of toDelete) {
              await db.subtasks.where('taskId').equals(id).delete();
              // And delete from Firestore
              deleteDoc(doc(firestore, 'users', uid, 'tasks', id));
          }
      }
    } catch (err) {
      console.error("[useSync] Cleanup error:", err);
    }
  };

  return null;
};
