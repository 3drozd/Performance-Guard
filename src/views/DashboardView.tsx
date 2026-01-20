import { memo } from 'react';
import { SystemStats, AppList } from '../components/dashboard';
import { AnimatedContainer, AnimatedItem } from '../components/common';
import type { AppSummary, SystemStats as SystemStatsType } from '../types';

interface DashboardViewProps {
  apps: AppSummary[];
  systemStats: SystemStatsType;
  onSelectApp: (appName: string) => void;
  isActive: boolean;
  initiallyHidden?: boolean;
}

export const DashboardView = memo(function DashboardView({
  apps,
  systemStats,
  onSelectApp,
  isActive,
  initiallyHidden = false,
}: DashboardViewProps) {
  return (
    <AnimatedContainer
      isActive={isActive}
      staggerDelay={100}
      initialDelay={100}
      className="flex flex-col gap-6 p-6 h-full overflow-hidden min-w-[800px]"
      initiallyHidden={initiallyHidden}
    >
      <AnimatedItem className="flex-shrink-0">
        <SystemStats stats={systemStats} />
      </AnimatedItem>
      <AnimatedItem className="flex-1 min-h-0">
        <AppList apps={apps} onSelectApp={onSelectApp} />
      </AnimatedItem>
    </AnimatedContainer>
  );
});
