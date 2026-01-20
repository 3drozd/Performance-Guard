import { memo } from 'react';
import { Cpu, MemoryStick, HardDrive, Activity } from 'lucide-react';
import { StatCard } from '../common';
import { formatCpuPercent } from '../../utils/formatters';
import type { SystemStats as SystemStatsType } from '../../types';

interface SystemStatsProps {
  stats: SystemStatsType;
}

export const SystemStats = memo(function SystemStats({ stats }: SystemStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard
        icon={Cpu}
        label="CPU Usage"
        value={formatCpuPercent(stats.cpu_percent)}
        subValue={`${stats.cpu_cores} cores`}
        iconColor="text-accent-blue"
      />
      <StatCard
        icon={MemoryStick}
        label="Memory Usage"
        value={formatCpuPercent(stats.memory_percent)}
        subValue={`${stats.available_memory_gb.toFixed(1)} GB available`}
        iconColor="text-accent-green"
      />
      <StatCard
        icon={HardDrive}
        label="Total Memory"
        value={`${stats.total_memory_gb.toFixed(0)} GB`}
        subValue="System RAM"
        iconColor="text-accent-yellow"
      />
      <StatCard
        icon={Activity}
        label="System Load"
        value={stats.cpu_percent > 70 ? 'High' : stats.cpu_percent > 40 ? 'Medium' : 'Low'}
        subValue={`${stats.cpu_percent.toFixed(0)}% utilization`}
        iconColor={stats.cpu_percent > 70 ? 'text-accent-red' : stats.cpu_percent > 40 ? 'text-accent-yellow' : 'text-accent-green'}
      />
    </div>
  );
});
