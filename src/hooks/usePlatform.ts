import { useState, useEffect } from 'react';
import { platform } from '@tauri-apps/plugin-os';

export type Platform = 'windows' | 'macos' | 'linux' | 'unknown';

export function usePlatform(): Platform {
  const [os, setOs] = useState<Platform>('unknown');

  useEffect(() => {
    platform().then((p) => {
      if (p === 'windows' || p === 'macos' || p === 'linux') {
        setOs(p);
      }
    }).catch(() => {
      // Fallback for dev mode or error
      setOs('unknown');
    });
  }, []);

  return os;
}
