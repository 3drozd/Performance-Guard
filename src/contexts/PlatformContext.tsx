import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { platform } from '@tauri-apps/plugin-os';

export type Platform = 'windows' | 'macos' | 'linux' | 'unknown';

const PlatformContext = createContext<Platform>('unknown');

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [os, setOs] = useState<Platform>('unknown');

  useEffect(() => {
    platform().then((p) => {
      if (p === 'windows' || p === 'macos' || p === 'linux') {
        setOs(p);
      }
    }).catch(() => {
      setOs('unknown');
    });
  }, []);

  return (
    <PlatformContext.Provider value={os}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): Platform {
  return useContext(PlatformContext);
}
