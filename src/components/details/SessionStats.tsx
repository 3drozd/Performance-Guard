import { memo, useState, useRef, useEffect } from 'react';
import { Cpu, MemoryStick, Clock, Monitor, ChevronDown, AppWindow } from 'lucide-react';
import { StatCard } from '../common';
import { formatCpuPercent, formatMemoryMB, formatDuration } from '../../utils/formatters';
import type { Session, AppSummary } from '../../types';

interface SessionStatsProps {
  session: Session | null;
  apps: AppSummary[];
  selectedApp: string | null;
  onSelectApp: (appName: string) => void;
  animationKey?: number;
}

export const SessionStats = memo(function SessionStats({
  session,
  apps,
  selectedApp,
  onSelectApp,
  animationKey
}: SessionStatsProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format GPU percent
  const formatGpuPercent = (value: number | undefined) => {
    if (value === undefined || value === null) return '0%';
    return `${value.toFixed(1)}%`;
  };

  // Get current app info
  const currentApp = apps.find(app => app.name === selectedApp);
  const displayName = selectedApp ? selectedApp.replace(/\.exe$/i, '') : 'Select App';

  return (
    <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-3">
      {/* App Selector - dropdown */}
      <div className={`stat-card flex items-center px-2.5 py-1.5 relative mr-6 bg-gradient-to-r from-accent-blue/10 to-transparent border-accent-blue/30 min-w-[160px] ${isDropdownOpen ? 'z-50' : ''}`} ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 w-full hover:bg-bg-card-hover rounded-md p-1 -m-1 transition-colors"
        >
          {/* App icon */}
          {currentApp?.icon ? (
            <img
              src={`data:image/png;base64,${currentApp.icon}`}
              alt=""
              className="w-7 h-7 rounded-md flex-shrink-0 object-contain"
            />
          ) : (
            <div className={`p-1.5 rounded-md bg-bg-elevated ${currentApp?.is_running ? 'text-accent-green' : 'text-text-muted'}`}>
              <AppWindow size={14} />
            </div>
          )}

          {/* App name and switch text */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-text-primary truncate leading-tight">{displayName}</p>
            <p className="text-[10px] text-accent-blue leading-tight">Switch App</p>
          </div>

          {/* Dropdown arrow */}
          <ChevronDown
            size={14}
            className={`text-text-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown menu */}
        {isDropdownOpen && apps.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-zinc-700 rounded-lg shadow-xl z-[100] overflow-hidden">
            {apps.map(app => (
              <button
                key={app.name}
                onClick={() => {
                  onSelectApp(app.name);
                  setIsDropdownOpen(false);
                }}
                className={`
                  w-full px-3 py-2 flex items-center gap-2 text-left transition-colors
                  ${selectedApp === app.name
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'hover:bg-bg-card-hover text-text-primary'
                  }
                `}
              >
                {app.icon ? (
                  <img
                    src={`data:image/png;base64,${app.icon}`}
                    alt=""
                    className="w-5 h-5 rounded flex-shrink-0 object-contain"
                  />
                ) : (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${app.is_running ? 'bg-accent-green' : 'bg-zinc-500'}`} />
                )}
                <span className="text-xs truncate">{app.name.replace(/\.exe$/i, '')}</span>
                {app.is_running && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green ml-auto flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Duration */}
      <StatCard
        icon={Clock}
        label="Duration"
        value={session ? formatDuration(session.duration_seconds) : '--:--'}
        subValue={session?.is_current ? 'Active' : session ? 'Ended' : 'No session'}
        iconColor="text-accent-blue"
        compact
        animationKey={animationKey}
      />

      {/* Avg CPU */}
      <StatCard
        icon={Cpu}
        label="Avg CPU"
        value={session ? formatCpuPercent(session.avg_cpu_percent) : '--%'}
        subValue={session ? `Peak: ${formatCpuPercent(session.peak_cpu_percent)}` : ''}
        iconColor="text-accent-blue"
        compact
        animationKey={animationKey}
      />

      {/* Avg Memory */}
      <StatCard
        icon={MemoryStick}
        label="Avg Memory"
        value={session ? formatMemoryMB(session.avg_memory_mb) : '--MB'}
        subValue={session ? `Peak: ${formatMemoryMB(session.peak_memory_mb)}` : ''}
        iconColor="text-accent-yellow"
        compact
        animationKey={animationKey}
      />

      {/* Avg GPU */}
      <StatCard
        icon={Monitor}
        label="Avg GPU"
        value={session ? formatGpuPercent(session.avg_gpu_percent) : '--%'}
        subValue={session ? `Peak: ${formatGpuPercent(session.peak_gpu_percent)}` : ''}
        iconColor="text-accent-purple"
        compact
        animationKey={animationKey}
      />
    </div>
  );
});
