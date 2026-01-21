import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { platform } from '@tauri-apps/plugin-os';

export type PlatformType = 'windows' | 'macos' | 'linux' | 'unknown';

const PlatformContext = createContext<PlatformType>('unknown');

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [os, setOs] = useState<PlatformType>('unknown');

  useEffect(() => {
    try {
      const p = platform();
      if (p === 'windows' || p === 'macos' || p === 'linux') {
        setOs(p);
      }
    } catch {
      setOs('unknown');
    }
  }, []);

  return (
    <PlatformContext.Provider value={os}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformType {
  return useContext(PlatformContext);
}
