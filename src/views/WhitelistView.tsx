import { memo, useState, useEffect, useRef } from 'react';
import { ProcessList, WhitelistManager } from '../components/whitelist';
import { AnimatedContainer, AnimatedItem } from '../components/common';
import { getAppIcon } from '../api/tauri';
import type { ProcessInfo, WhitelistEntry } from '../types';

interface WhitelistViewProps {
  processes: ProcessInfo[];
  whitelist: WhitelistEntry[];
  onToggleWhitelist: (processName: string) => void;
  onRemoveFromWhitelist: (id: number) => void;
  onBrowse: () => void;
  onRefreshProcesses: () => void;
  isActive: boolean;
  initiallyHidden?: boolean;
}

export const WhitelistView = memo(function WhitelistView({
  processes,
  whitelist,
  onToggleWhitelist,
  onRemoveFromWhitelist,
  onBrowse,
  onRefreshProcesses,
  isActive,
  initiallyHidden = false,
}: WhitelistViewProps) {
  const [whitelistIcons, setWhitelistIcons] = useState<{ [name: string]: string }>({});
  const iconFetchedRef = useRef<Set<string>>(new Set());

  // Create set of whitelisted names for quick lookup
  const whitelistedNames = new Set(whitelist.map(w => w.name));

  // Fetch icons for whitelist entries
  useEffect(() => {
    whitelist.forEach(entry => {
      if (entry.exe_path && !iconFetchedRef.current.has(entry.name)) {
        iconFetchedRef.current.add(entry.name);
        getAppIcon(entry.exe_path).then(icon => {
          if (icon) {
            setWhitelistIcons(prev => ({ ...prev, [entry.name]: icon }));
          }
        });
      }
    });
  }, [whitelist]);

  return (
    <AnimatedContainer
      isActive={isActive}
      staggerDelay={100}
      initialDelay={100}
      className="flex gap-6 p-6 h-full overflow-hidden min-w-[812px]"
      initiallyHidden={initiallyHidden}
    >
      {/* Left side - Process list */}
      <AnimatedItem className="flex-1 min-w-0">
        <ProcessList
          processes={processes}
          whitelistedNames={whitelistedNames}
          onToggleWhitelist={onToggleWhitelist}
          onRefresh={onRefreshProcesses}
          isActive={isActive}
        />
      </AnimatedItem>

      {/* Right side - Whitelist manager */}
      <AnimatedItem>
        <WhitelistManager
          whitelist={whitelist}
          icons={whitelistIcons}
          onRemove={onRemoveFromWhitelist}
          onBrowse={onBrowse}
        />
      </AnimatedItem>
    </AnimatedContainer>
  );
});
