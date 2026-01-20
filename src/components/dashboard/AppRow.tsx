import { memo, useCallback } from 'react';
import { Play, MoreVertical, AppWindow } from 'lucide-react';
import { ProgressBar } from '../common';
import { formatDurationCompact, formatEfficiencyBadge } from '../../utils/formatters';
import type { AppSummary } from '../../types';

interface AppRowProps {
  app: AppSummary;
  onSelect: (appName: string) => void;
}

export const AppRow = memo(function AppRow({ app, onSelect }: AppRowProps) {
  const handleClick = useCallback(() => {
    onSelect(app.name);
  }, [app.name, onSelect]);

  const efficiencyStyle = formatEfficiencyBadge(app.efficiency_percent);

  // Calculate ratios for stacked progress bar (active + idle + background = 100%)
  const activeRatio = app.total_time_seconds > 0
    ? (app.active_time_seconds / app.total_time_seconds) * 100
    : 0;
  const idleRatio = app.total_time_seconds > 0
    ? (app.idle_time_seconds / app.total_time_seconds) * 100
    : 0;

  const totalTimeDisplay = app.total_time_seconds > 0 ? formatDurationCompact(app.total_time_seconds) : '-';
  const activeTimeDisplay = formatDurationCompact(app.active_time_seconds);
  const idleTimeDisplay = formatDurationCompact(app.idle_time_seconds);
  const backgroundTimeDisplay = formatDurationCompact(app.background_time_seconds);
  const usageDisplay = `${app.avg_usage_percent.toFixed(0)}%`;
  const efficiencyDisplay = `${app.efficiency_percent.toFixed(0)}%`;

  return (
    <div
      onClick={handleClick}
      className="grid grid-cols-[1fr_90px_140px_80px_90px_40px] items-center gap-4 px-4 py-3 hover:bg-bg-card-hover cursor-pointer transition-colors border-b border-zinc-800/50 last:border-b-0"
    >
      {/* App name and status */}
      <div className="flex items-center gap-3 min-w-0">
        {/* App icon or status indicator */}
        {app.icon ? (
          <div className="relative flex-shrink-0">
            <img
              src={`data:image/png;base64,${app.icon}`}
              alt=""
              className="w-8 h-8 rounded-lg object-contain"
            />
            {/* Running indicator dot */}
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-card ${app.is_running ? 'bg-accent-green' : 'bg-zinc-500'}`} />
          </div>
        ) : (
          <div className={`p-1.5 rounded-lg ${app.is_running ? 'bg-accent-green/20' : 'bg-zinc-800'}`}>
            {app.is_running ? (
              <Play size={14} className="text-accent-green" fill="currentColor" />
            ) : (
              <AppWindow size={14} className="text-text-muted" />
            )}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{app.name.replace(/\.exe$/i, '')}</p>
          <p className="text-xs text-text-muted truncate">{app.session_count} sessions</p>
        </div>
      </div>

      {/* Total Time */}
      <span className="text-sm text-text-primary text-center justify-self-center">
        {totalTimeDisplay}
      </span>

      {/* Active / Idle / Background with stacked progress bar */}
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center gap-1 text-xs">
          <span className="text-accent-green">{activeTimeDisplay}</span>
          <span className="text-text-muted">/</span>
          <span className="text-accent-sky">{idleTimeDisplay}</span>
          <span className="text-text-muted">/</span>
          <span className="text-zinc-500">{backgroundTimeDisplay}</span>
        </div>
        {/* Stacked progress bar: green (active) + yellow (idle) + gray (background) */}
        <div className="h-1 w-full bg-zinc-700 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-accent-green"
            style={{ width: `${activeRatio}%` }}
          />
          <div
            className="h-full bg-accent-sky"
            style={{ width: `${idleRatio}%` }}
          />
        </div>
      </div>

      {/* Usage */}
      <div className="flex flex-col gap-1">
        <span className="text-sm text-text-primary text-center">{usageDisplay}</span>
        <ProgressBar
          value={app.avg_usage_percent}
          color={app.avg_usage_percent > 50 ? 'red' : app.avg_usage_percent > 25 ? 'yellow' : 'blue'}
          size="sm"
        />
      </div>

      {/* Efficiency badge */}
      <div className="flex justify-center">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${efficiencyStyle.bg} ${efficiencyStyle.color}`}>
          {efficiencyDisplay}
        </span>
      </div>

      {/* Actions */}
      <button
        onClick={(e) => e.stopPropagation()}
        className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
      >
        <MoreVertical size={16} />
      </button>
    </div>
  );
});
