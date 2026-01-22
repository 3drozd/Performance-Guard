import { memo } from 'react';
import { SystemStats, AppList, CategoryBreakdown, DailySummary } from '../components/dashboard';
import { AnimatedContainer, AnimatedItem } from '../components/common';
import type { AppSummary, SystemStats as SystemStatsType, Session, WhitelistEntry } from '../types';

interface DashboardViewProps {
  apps: AppSummary[];
  systemStats: SystemStatsType;
  sessions: Session[];
  whitelist: WhitelistEntry[];
  appIcons: Map<string, string>;
  onSelectApp: (appName: string) => void;
  isActive: boolean;
  initiallyHidden?: boolean;
}

export const DashboardView = memo(function DashboardView({
  apps,
  systemStats,
  sessions,
  whitelist,
  appIcons,
  onSelectApp,
  isActive,
  initiallyHidden = false,
}: DashboardViewProps) {
  return (
    <AnimatedContainer
      isActive={isActive}
      staggerDelay={100}
      initialDelay={100}
      className="flex flex-col gap-6 p-6 h-full overflow-y-scroll min-w-[800px]"
      initiallyHidden={initiallyHidden}
    >
      <AnimatedItem className="flex-shrink-0">
        <DailySummary
          sessions={sessions}
          whitelist={whitelist}
          appIcons={appIcons}
        />
      </AnimatedItem>
      <AnimatedItem className="flex-shrink-0">
        <CategoryBreakdown apps={apps} />
      </AnimatedItem>
      <AnimatedItem className="flex-shrink-0">
        <SystemStats stats={systemStats} />
      </AnimatedItem>
      <AnimatedItem className="flex-shrink-0 min-h-[400px]">
        <AppList apps={apps} onSelectApp={onSelectApp} />
      </AnimatedItem>
    </AnimatedContainer>
  );
});
