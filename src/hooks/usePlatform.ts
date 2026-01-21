import { useState, useEffect } from 'react';
import { platform } from '@tauri-apps/plugin-os';

export type PlatformType = 'windows' | 'macos' | 'linux' | 'unknown';

export function usePlatform(): PlatformType {
  const [os, setOs] = useState<PlatformType>('unknown');

  useEffect(() => {
    try {
      const p = platform();
      if (p === 'windows' || p === 'macos' || p === 'linux') {
        setOs(p);
      }
    } catch {
      // Fallback for dev mode or error
      setOs('unknown');
    }
  }, []);

  return os;
}
