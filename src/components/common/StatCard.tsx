import { memo, useState, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subValue?: string;
  iconColor?: string;
  compact?: boolean;
  animationKey?: number;
}

// Parse value into numeric part and format info
function parseValue(value: string): { num: number; prefix: string; suffix: string; decimals: number; originalFormat: string } {
  if (!value || value === '--:--' || value === '--%' || value === '--MB') {
    return { num: 0, prefix: '', suffix: value, decimals: 0, originalFormat: 'placeholder' };
  }

  // Handle duration format: "5m", "2h 15m", "1h", "45s", etc.
  const durationMatch = value.match(/^(?:(\d+)h\s*)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (durationMatch && (durationMatch[1] || durationMatch[2] || durationMatch[3])) {
    const hours = parseInt(durationMatch[1] || '0', 10);
    const mins = parseInt(durationMatch[2] || '0', 10);
    const secs = parseInt(durationMatch[3] || '0', 10);
    const totalSeconds = hours * 3600 + mins * 60 + secs;
    return { num: totalSeconds, prefix: '', suffix: ':duration', decimals: 0, originalFormat: value };
  }

  // Handle regular numbers with prefix/suffix (e.g., "45.2%", "1.2 GB", "500.0 MB")
  const match = value.match(/^([^0-9]*)([0-9]+(?:\.[0-9]+)?)(.*)$/);
  if (!match) return { num: 0, prefix: '', suffix: value, decimals: 0, originalFormat: 'unknown' };

  const [, prefix, numStr, suffix] = match;
  const num = parseFloat(numStr);
  const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;

  return { num, prefix, suffix, decimals, originalFormat: 'number' };
}

// Format value back to string
function formatValue(num: number, prefix: string, suffix: string, decimals: number, originalFormat: string): string {
  if (suffix === ':duration') {
    const totalSeconds = Math.floor(num);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);

    // Match the original format style
    if (originalFormat.includes('h') && originalFormat.includes('m')) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    if (originalFormat.includes('h')) {
      return `${hours}h`;
    }
    if (originalFormat.includes('s') && !originalFormat.includes('m')) {
      return `${totalSeconds}s`;
    }
    // Default: just minutes
    return `${Math.floor(totalSeconds / 60)}m`;
  }

  return `${prefix}${num.toFixed(decimals)}${suffix}`;
}

// Count up animation for value text
// Animates from current displayed value to new value (not from zero)
function useCountUp(value: string, animationKey: number | undefined, duration: number = 400) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevKeyRef = useRef<number>(-1);
  const prevValueRef = useRef(value);
  const displayValueRef = useRef(value); // Track display value in ref for animation
  const animationRef = useRef<number | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    displayValueRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    // No animation key provided - just show value immediately
    if (animationKey === undefined) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    // Cancel any running animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const { num: targetNum, prefix, suffix, decimals, originalFormat } = parseValue(value);

    // Skip animation for placeholder values
    if (suffix === value) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    // Animation key changed - animate from current value to new value
    // Note: animate on any key change, including first key (0 -> 1)
    if (animationKey !== prevKeyRef.current) {
      prevKeyRef.current = animationKey;

      // Get current displayed value as starting point (not zero!)
      const { num: startNum } = parseValue(displayValueRef.current);
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing: ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        // Animate from startNum to targetNum
        const currentNum = startNum + (targetNum - startNum) * eased;

        const newDisplay = formatValue(currentNum, prefix, suffix, decimals, originalFormat);
        setDisplayValue(newDisplay);
        displayValueRef.current = newDisplay;

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(value); // Final exact value
          displayValueRef.current = value;
          prevValueRef.current = value;
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }

    // Value changed but animation key didn't - just update value (live updates)
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      setDisplayValue(value);
      displayValueRef.current = value;
    }
  }, [value, animationKey, duration]);

  return displayValue;
}

export const StatCard = memo(function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  iconColor = 'text-accent-blue',
  compact = false,
  animationKey,
}: StatCardProps) {
  const displayValue = useCountUp(value, animationKey, 400);

  if (compact) {
    return (
      <div className="stat-card flex items-center gap-2 px-2.5 py-1.5">
        <div className={`p-1.5 rounded-md bg-bg-elevated ${iconColor}`}>
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-text-muted uppercase tracking-wider leading-tight whitespace-nowrap">{label}</p>
          <p className="text-base font-semibold text-text-primary truncate leading-tight whitespace-nowrap">
            {displayValue}
          </p>
          {subValue && (
            <p className="text-[10px] text-text-secondary truncate leading-tight whitespace-nowrap">{subValue}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card flex items-center gap-4">
      <div className={`p-2.5 rounded-lg bg-bg-elevated ${iconColor}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-muted uppercase tracking-wider whitespace-nowrap">{label}</p>
        <p className="text-xl font-semibold text-text-primary truncate whitespace-nowrap">
          {displayValue}
        </p>
        {subValue && (
          <p className="text-xs text-text-secondary truncate whitespace-nowrap">{subValue}</p>
        )}
      </div>
    </div>
  );
});
