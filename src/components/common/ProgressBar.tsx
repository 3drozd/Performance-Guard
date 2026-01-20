import { memo, useMemo } from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export const ProgressBar = memo(function ProgressBar({
  value,
  max = 100,
  color = 'blue',
  size = 'md',
  showLabel = false,
}: ProgressBarProps) {
  const percentage = useMemo(() => Math.min((value / max) * 100, 100), [value, max]);

  const colorStyles = {
    blue: 'bg-accent-blue',
    green: 'bg-accent-green',
    yellow: 'bg-accent-yellow',
    red: 'bg-accent-red',
  };

  const sizeStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-bg-elevated rounded-full overflow-hidden ${sizeStyles[size]}`}>
        <div
          className={`h-full ${colorStyles[color]} rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-text-muted min-w-[40px] text-right">
          {percentage.toFixed(1)}%
        </span>
      )}
    </div>
  );
});
