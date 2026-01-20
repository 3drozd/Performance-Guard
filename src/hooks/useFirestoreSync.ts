import { useCallback, useRef } from 'react';
import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { WhitelistEntry, Session, PerformanceSnapshot } from '../types';

// Firestore document types (simplified for storage)
interface FirestoreWhitelistEntry {
  id: number;
  name: string;
  exe_path: string | null;
  added_date: string;
  is_tracked: boolean;
  updated_at: Timestamp;
}

interface FirestoreSession {
  id: number;
  app_name: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  avg_cpu_percent: number;
  avg_memory_mb: number;
  avg_gpu_percent: number;
  peak_cpu_percent: number;
  peak_memory_mb: number;
  peak_gpu_percent: number;
  performance_history: PerformanceSnapshot[];
  updated_at: Timestamp;
}

export function useFirestoreSync(uid: string | null) {
  const isSyncingRef = useRef(false);

  // Save whitelist to Firestore
  const saveWhitelist = useCallback(async (whitelist: WhitelistEntry[]) => {
    if (!uid || isSyncingRef.current) return;

    try {
      isSyncingRef.current = true;
      const whitelistRef = collection(db, 'users', uid, 'whitelist');

      // Get existing docs to determine which to delete
      const existingDocs = await getDocs(whitelistRef);
      const existingIds = new Set<string>();
      existingDocs.forEach(doc => existingIds.add(doc.id));

      // SAFETY: Don't overwrite non-empty cloud data with empty local data
      if (whitelist.length === 0 && existingIds.size > 0) {
        console.warn('Refusing to overwrite non-empty cloud whitelist with empty data');
        return;
      }

      const batch = writeBatch(db);

      // Add/update entries
      const newIds = new Set<string>();
      for (const entry of whitelist) {
        const docId = `app_${entry.id}`;
        newIds.add(docId);
        const docRef = doc(whitelistRef, docId);
        const data: FirestoreWhitelistEntry = {
          id: entry.id,
          name: entry.name,
          exe_path: entry.exe_path ?? null,
          added_date: entry.added_date,
          is_tracked: entry.is_tracked,
          updated_at: Timestamp.now(),
        };
        batch.set(docRef, data);
      }

      // Delete removed entries
      existingIds.forEach(id => {
        if (!newIds.has(id)) {
          batch.delete(doc(whitelistRef, id));
        }
      });

      await batch.commit();
    } catch (error) {
      console.error('Error saving whitelist to Firestore:', error);
      throw error;
    } finally {
      isSyncingRef.current = false;
    }
  }, [uid]);

  // Save sessions to Firestore
  const saveSessions = useCallback(async (sessions: Session[]) => {
    if (!uid || isSyncingRef.current) return;

    try {
      isSyncingRef.current = true;
      const sessionsRef = collection(db, 'users', uid, 'sessions');

      // Only save completed sessions (not current)
      const completedSessions = sessions.filter(s => !s.is_current);

      // SAFETY: Don't overwrite non-empty cloud data with empty local data
      if (completedSessions.length === 0) {
        const existingDocs = await getDocs(sessionsRef);
        if (existingDocs.size > 0) {
          console.warn('Refusing to overwrite non-empty cloud sessions with empty data');
          return;
        }
      }

      const batch = writeBatch(db);

      for (const session of completedSessions) {
        const docId = `session_${session.id}`;
        const docRef = doc(sessionsRef, docId);
        const data: FirestoreSession = {
          id: session.id,
          app_name: session.app_name,
          start_time: session.start_time,
          end_time: session.end_time ?? null,
          duration_seconds: session.duration_seconds,
          avg_cpu_percent: session.avg_cpu_percent,
          avg_memory_mb: session.avg_memory_mb,
          avg_gpu_percent: session.avg_gpu_percent,
          peak_cpu_percent: session.peak_cpu_percent,
          peak_memory_mb: session.peak_memory_mb,
          peak_gpu_percent: session.peak_gpu_percent,
          performance_history: session.performance_history || [],
          updated_at: Timestamp.now(),
        };
        batch.set(docRef, data);
      }

      await batch.commit();
    } catch (error) {
      console.error('Error saving sessions to Firestore:', error);
      throw error;
    } finally {
      isSyncingRef.current = false;
    }
  }, [uid]);

  // Load whitelist from Firestore
  const loadWhitelist = useCallback(async (): Promise<WhitelistEntry[]> => {
    if (!uid) return [];

    try {
      const whitelistRef = collection(db, 'users', uid, 'whitelist');
      const snapshot = await getDocs(query(whitelistRef));

      const whitelist: WhitelistEntry[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as FirestoreWhitelistEntry;
        whitelist.push({
          id: data.id,
          name: data.name,
          exe_path: data.exe_path ?? undefined,
          added_date: data.added_date,
          is_tracked: data.is_tracked,
        });
      });

      return whitelist;
    } catch (error) {
      console.error('Error loading whitelist from Firestore:', error);
      throw error;
    }
  }, [uid]);

  // Load sessions from Firestore
  const loadSessions = useCallback(async (): Promise<Session[]> => {
    if (!uid) return [];

    try {
      const sessionsRef = collection(db, 'users', uid, 'sessions');
      const snapshot = await getDocs(query(sessionsRef));

      const sessions: Session[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as FirestoreSession;
        sessions.push({
          id: data.id,
          app_name: data.app_name,
          start_time: data.start_time,
          end_time: data.end_time ?? undefined,
          duration_seconds: data.duration_seconds,
          avg_cpu_percent: data.avg_cpu_percent,
          avg_memory_mb: data.avg_memory_mb,
          avg_gpu_percent: data.avg_gpu_percent,
          peak_cpu_percent: data.peak_cpu_percent,
          peak_memory_mb: data.peak_memory_mb,
          peak_gpu_percent: data.peak_gpu_percent,
          is_current: false,
          performance_history: data.performance_history || [],
        });
      });

      return sessions;
    } catch (error) {
      console.error('Error loading sessions from Firestore:', error);
      throw error;
    }
  }, [uid]);

  // Merge local and cloud data (cloud wins on conflict by default)
  const mergeData = useCallback((
    localWhitelist: WhitelistEntry[],
    cloudWhitelist: WhitelistEntry[],
    localSessions: Session[],
    cloudSessions: Session[]
  ): { whitelist: WhitelistEntry[]; sessions: Session[]; nextSessionId: number } => {
    // Merge whitelist - use name as key, prefer cloud version
    const whitelistMap = new Map<string, WhitelistEntry>();

    // Add local first
    localWhitelist.forEach(entry => {
      whitelistMap.set(entry.name.toLowerCase(), entry);
    });

    // Cloud overwrites local (except exe_path if cloud is null)
    cloudWhitelist.forEach(cloudEntry => {
      const key = cloudEntry.name.toLowerCase();
      const localEntry = whitelistMap.get(key);
      if (localEntry && !cloudEntry.exe_path && localEntry.exe_path) {
        // Keep local exe_path if cloud doesn't have it
        cloudEntry.exe_path = localEntry.exe_path;
      }
      whitelistMap.set(key, cloudEntry);
    });

    const mergedWhitelist = Array.from(whitelistMap.values());

    // Merge sessions - use id as key, prefer cloud version
    const sessionMap = new Map<number, Session>();

    localSessions.forEach(session => {
      sessionMap.set(session.id, session);
    });

    cloudSessions.forEach(session => {
      sessionMap.set(session.id, session);
    });

    const mergedSessions = Array.from(sessionMap.values())
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // Calculate next session id
    const maxId = Math.max(0, ...mergedSessions.map(s => s.id));

    return {
      whitelist: mergedWhitelist,
      sessions: mergedSessions,
      nextSessionId: maxId + 1,
    };
  }, []);

  // Delete a whitelist entry from Firestore
  const deleteWhitelistEntry = useCallback(async (entryId: number) => {
    if (!uid) return;

    try {
      const docRef = doc(db, 'users', uid, 'whitelist', `app_${entryId}`);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting whitelist entry from Firestore:', error);
    }
  }, [uid]);

  return {
    saveWhitelist,
    saveSessions,
    loadWhitelist,
    loadSessions,
    mergeData,
    deleteWhitelistEntry,
    isSyncing: isSyncingRef.current,
  };
}
