import { memo, useMemo } from 'react';
import { ChevronDown, Play, Square } from 'lucide-react';
import type { AppSummary } from '../../types';

interface AppSelectorProps {
  apps: AppSummary[];
  selectedApp: string | null;
  onSelectApp: (appName: string) => void;
}

export const AppSelector = memo(function AppSelector({
  apps,
  selectedApp,
  onSelectApp,
}: AppSelectorProps) {
  const selectedAppData = useMemo(() => {
    return apps.find(app => app.name === selectedApp);
  }, [apps, selectedApp]);

  return (
    <div className="glass-card p-4">
      <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
        Select Application
      </label>
      <div className="relative">
        <select
          value={selectedApp || ''}
          onChange={(e) => onSelectApp(e.target.value)}
          className="
            w-full appearance-none px-4 py-3 pr-10 rounded-lg
            bg-bg-elevated border border-zinc-700
            text-text-primary text-sm font-medium
            focus:outline-none focus:border-accent-blue
            cursor-pointer
          "
        >
          <option value="" disabled>
            Select an application...
          </option>
          {apps.map(app => (
            <option key={app.name} value={app.name}>
              {app.name} {app.is_running ? '●' : '○'}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
      </div>

      {selectedAppData && (
        <div className="mt-3 flex items-center gap-2">
          <div className={`p-1 rounded ${selectedAppData.is_running ? 'bg-accent-green/20' : 'bg-zinc-800'}`}>
            {selectedAppData.is_running ? (
              <Play size={12} className="text-accent-green" fill="currentColor" />
            ) : (
              <Square size={12} className="text-text-muted" />
            )}
          </div>
          <span className="text-xs text-text-muted">
            {selectedAppData.is_running ? 'Currently running' : 'Not running'}
          </span>
          <span className="text-xs text-text-muted">•</span>
          <span className="text-xs text-text-muted">
            {selectedAppData.session_count} sessions tracked
          </span>
        </div>
      )}
    </div>
  );
});
