import { memo, useCallback, useState, useEffect, useRef } from 'react';
import { Plus, Check, Cpu, MemoryStick, AppWindow } from 'lucide-react';
import { formatCpuPercent, formatMemoryMB } from '../../utils/formatters';
import type { ProcessInfo } from '../../types';

// Get app icon color based on process name (consistent color per app)
function getAppColor(name: string): string {
  const colors = [
    'text-blue-400',
    'text-green-400',
    'text-purple-400',
    'text-orange-400',
    'text-pink-400',
    'text-cyan-400',
    'text-yellow-400',
    'text-red-400',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

interface ProcessRowProps {
  process: ProcessInfo;
  icon?: string;
  isWhitelisted: boolean;
  onToggleWhitelist: (processName: string) => void;
  animationDelay?: number;
  isAnimating?: boolean;
  showGlow?: boolean;
  onAnimationComplete?: () => void;
}

export const ProcessRow = memo(function ProcessRow({
  process,
  icon,
  isWhitelisted,
  onToggleWhitelist,
  animationDelay = 0,
  isAnimating = false,
  showGlow = false,
  onAnimationComplete,
}: ProcessRowProps) {
  const [isVisible, setIsVisible] = useState(!isAnimating);
  const [currentX, setCurrentX] = useState(isAnimating ? -60 : 0);
  const [currentOpacity, setCurrentOpacity] = useState(isAnimating ? 0 : 1);
  const animationRef = useRef<number | null>(null);
  const hasCalledCompleteRef = useRef(false);
  const onAnimationCompleteRef = useRef(onAnimationComplete);

  // Keep callback ref updated
  onAnimationCompleteRef.current = onAnimationComplete;

  const handleToggle = useCallback(() => {
    onToggleWhitelist(process.name);
  }, [process.name, onToggleWhitelist]);

  // Spring animation
  useEffect(() => {
    if (!isAnimating) {
      // Not animating - just show immediately
      setIsVisible(true);
      setCurrentX(0);
      setCurrentOpacity(1);
      return;
    }

    hasCalledCompleteRef.current = false;

    const timeout = setTimeout(() => {
      setIsVisible(true);

      // Spring physics parameters - smooth animation
      const stiffness = 120;
      const damping = 14;
      const mass = 1;

      let velocity = 0;
      let position = -60;
      const targetPosition = 0;

      const animate = () => {
        // Spring force calculation
        const displacement = position - targetPosition;
        const springForce = -stiffness * displacement;
        const dampingForce = -damping * velocity;
        const acceleration = (springForce + dampingForce) / mass;

        velocity += acceleration * 0.016; // ~60fps
        position += velocity * 0.016;

        // Update state
        setCurrentX(position);
        setCurrentOpacity(Math.min(1, 1 - (Math.abs(position) / 60)));

        // Call complete early when close to target (for glow handoff)
        if (!hasCalledCompleteRef.current && Math.abs(position) < 15 && Math.abs(velocity) < 50) {
          hasCalledCompleteRef.current = true;
          onAnimationCompleteRef.current?.();
        }

        // Check if animation should continue
        if (Math.abs(velocity) > 0.05 || Math.abs(position - targetPosition) > 0.3) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setCurrentX(0);
          setCurrentOpacity(1);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    }, animationDelay);

    return () => {
      clearTimeout(timeout);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, animationDelay]);

  // Common styles for consistent height
  const rowClasses = `
    flex items-center gap-4 px-4 py-3 rounded-lg bg-bg-card
    border-2 transition-[border-color,box-shadow] duration-200
  `;

  if (!isVisible && isAnimating) {
    // Invisible placeholder with same structure to maintain exact layout
    return (
      <div className={`${rowClasses} border-transparent invisible`}>
        <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
          <AppWindow size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">&nbsp;</p>
          <p className="text-xs">&nbsp;</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 w-[70px]">
          <span className="w-[14px] h-[14px] flex-shrink-0" />
          <span className="text-sm">0%</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 w-[80px]">
          <span className="w-[14px] h-[14px] flex-shrink-0" />
          <span className="text-sm">0 MB</span>
        </div>
        <div className="p-2">
          <span className="w-[18px] h-[18px] block" />
        </div>
      </div>
    );
  }

  const iconColor = getAppColor(process.name);

  return (
    <div
      className={`
        ${rowClasses}
        ${showGlow ? 'border-accent-blue shadow-[0_0_12px_rgba(59,130,246,0.5)]' : 'border-transparent'}
      `}
      style={{
        transform: `translateX(${currentX}px)`,
        opacity: currentOpacity,
        willChange: isAnimating ? 'transform, opacity' : 'auto',
      }}
    >
      {/* App icon */}
      {icon ? (
        <img
          src={`data:image/png;base64,${icon}`}
          alt=""
          className="w-8 h-8 rounded-lg flex-shrink-0 object-contain"
        />
      ) : (
        <div className={`w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0 ${iconColor}`}>
          <AppWindow size={18} />
        </div>
      )}

      {/* Process info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{process.name.replace(/\.exe$/i, '')}</p>
        <p className="text-xs text-text-muted truncate">PID: {process.pid}</p>
      </div>

      {/* CPU */}
      <div className="flex items-center gap-1.5 flex-shrink-0 w-[70px]">
        <Cpu size={14} className="text-accent-blue flex-shrink-0" />
        <span className="text-sm text-text-secondary">{formatCpuPercent(process.cpu_percent)}</span>
      </div>

      {/* Memory */}
      <div className="flex items-center gap-1.5 flex-shrink-0 w-[80px]">
        <MemoryStick size={14} className="text-accent-green flex-shrink-0" />
        <span className="text-sm text-text-secondary">{formatMemoryMB(process.memory_mb)}</span>
      </div>

      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className={`
          p-2 rounded-lg transition-colors
          ${isWhitelisted
            ? 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30'
            : 'bg-bg-elevated text-text-muted hover:text-text-primary hover:bg-bg-card-hover'
          }
        `}
      >
        {isWhitelisted ? <Check size={18} /> : <Plus size={18} />}
      </button>
    </div>
  );
});
