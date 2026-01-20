import { useState, useCallback, useRef } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'up-to-date';

export interface UpdateInfo {
  version: string;
  body: string;
  date?: string;
}

export interface UseAppUpdaterReturn {
  status: UpdateStatus;
  progress: number;
  updateInfo: UpdateInfo | null;
  error: string | null;
  checkForUpdates: () => Promise<boolean>;
  downloadAndInstall: () => Promise<void>;
  restart: () => Promise<void>;
}

export function useAppUpdater(): UseAppUpdaterReturn {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updateRef = useRef<Update | null>(null);

  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    setStatus('checking');
    setError(null);

    try {
      const update = await check();

      if (update?.available) {
        updateRef.current = update;
        setUpdateInfo({
          version: update.version,
          body: update.body || '',
          date: update.date || undefined,
        });
        setStatus('available');
        return true;
      } else {
        setStatus('up-to-date');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check for updates';
      setError(message);
      setStatus('error');
      return false;
    }
  }, []);

  const downloadAndInstall = useCallback(async (): Promise<void> => {
    if (!updateRef.current?.available) {
      setError('No update available');
      return;
    }

    setStatus('downloading');
    setProgress(0);

    try {
      let downloaded = 0;
      let contentLength = 0;

      await updateRef.current.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            setProgress(100);
            break;
        }
      });

      setStatus('ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download update';
      setError(message);
      setStatus('error');
    }
  }, []);

  const restart = useCallback(async (): Promise<void> => {
    try {
      await relaunch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restart';
      setError(message);
    }
  }, []);

  return {
    status,
    progress,
    updateInfo,
    error,
    checkForUpdates,
    downloadAndInstall,
    restart,
  };
}
