import { memo } from 'react';
import { useDailyStats } from '../../hooks/useDailyStats';
import { TrendingUp, TrendingDown, Calendar, Zap, Hash, Award } from 'lucide-react';
import type { Session, WhitelistEntry } from '../../types';

interface DailySummaryProps {
  sessions: Session[];
  whitelist: WhitelistEntry[];
  appIcons: Map<string, string>;
}

export const DailySummary = memo(function DailySummary({
  sessions,
  whitelist,
  appIcons
}: DailySummaryProps) {
  const dailyStats = useDailyStats(sessions, new Date(), whitelist);

  // Format czasu
  const totalHours = (dailyStats.total_time_seconds / 3600).toFixed(1);
  const productiveHours = (dailyStats.productive_time_seconds / 3600).toFixed(1);
  const efficiencyPercent = dailyStats.average_efficiency_percent.toFixed(0);

  // Porównanie z wczoraj
  const comparison = dailyStats.comparison_yesterday;
  const productiveChange = comparison?.productive_time_change_percent || 0;
  const efficiencyChange = comparison?.efficiency_change_percent || 0;

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
          <Calendar size={18} className="text-accent-blue" />
          Today's Summary
        </h2>
        <span className="text-xs text-text-secondary">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* Metryki Grid (4 kolumny) */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <MetricCard
          icon={<Zap className="text-accent-yellow" size={16} />}
          label="Total Time"
          value={`${totalHours}h`}
          subtitle={`${dailyStats.session_count} sessions`}
        />
        <MetricCard
          icon={<Award className="text-accent-green" size={16} />}
          label="Productive"
          value={`${productiveHours}h`}
          change={productiveChange}
        />
        <MetricCard
          icon={<Hash className="text-accent-blue" size={16} />}
          label="Efficiency"
          value={`${efficiencyPercent}%`}
          change={efficiencyChange}
        />
        <MetricCard
          icon={
            dailyStats.top_apps[0] ? (
              <AppIcon src={appIcons.get(dailyStats.top_apps[0].name)} />
            ) : (
              <Zap size={16} />
            )
          }
          label="Top App"
          value={dailyStats.top_apps[0]?.name.substring(0, 12) || 'N/A'}
          subtitle={
            dailyStats.top_apps[0]
              ? formatDuration(dailyStats.top_apps[0].time_seconds)
              : ''
          }
        />
      </div>

      {/* Progress Bar: Productive vs Distractive */}
      {dailyStats.total_time_seconds > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-accent-green transition-all rounded-sm"
                style={{
                  width: `${(dailyStats.productive_time_seconds / dailyStats.total_time_seconds) * 100}%`
                }}
              />
              <div
                className="bg-accent-red transition-all rounded-sm"
                style={{
                  width: `${(dailyStats.distractive_time_seconds / dailyStats.total_time_seconds) * 100}%`
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-accent-green" />
                Productive: {productiveHours}h
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-accent-red" />
                Distractive: {((dailyStats.distractive_time_seconds / 3600).toFixed(1))}h
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ========== Helper Components ==========

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  change?: number;
}

const MetricCard = ({ icon, label, value, subtitle, change }: MetricCardProps) => (
  <div className="bg-bg-elevated rounded-lg p-3">
    <div className="flex items-start justify-between mb-2">
      {icon}
      {change !== undefined && <ChangeIndicator value={change} />}
    </div>
    <div className="text-xs text-text-secondary mb-1">{label}</div>
    <div className="text-base font-semibold text-text-primary truncate">{value}</div>
    {subtitle && <div className="text-xs text-text-secondary mt-1">{subtitle}</div>}
  </div>
);

const ChangeIndicator = ({ value }: { value: number }) => {
  const isPositive = value > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive ? 'text-accent-green' : 'text-accent-red';

  return (
    <div className={`flex items-center gap-1 text-xs ${colorClass}`}>
      <Icon size={12} />
      {Math.abs(value).toFixed(0)}%
    </div>
  );
};

const AppIcon = ({ src }: { src?: string }) => (
  src ? (
    <img src={`data:image/png;base64,${src}`} className="w-4 h-4 object-contain" alt="" />
  ) : (
    <Zap size={16} />
  )
);

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
