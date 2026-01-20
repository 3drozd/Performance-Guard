import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Clock, Play, Square, History } from 'lucide-react';
import { Pagination, Select } from '../common';
import { formatDuration } from '../../utils/formatters';
import { exportData } from '../../utils/export';
import type { Session, ExportFormat } from '../../types';

// Calculate user efficiency from performance history
// Efficiency = average of user_activity_percent from foreground snapshots
const calculateEfficiency = (session: Session): number => {
  if (!session.performance_history || session.performance_history.length === 0) {
    return 0;
  }
  // Only consider foreground snapshots for efficiency calculation
  const foregroundSnapshots = session.performance_history.filter(p => p.is_foreground);
  if (foregroundSnapshots.length === 0) {
    return 0;
  }
  // Average of user_activity_percent
  const avgActivity = foregroundSnapshots.reduce((sum, p) => sum + p.user_activity_percent, 0) / foregroundSnapshots.length;
  return Math.round(avgActivity);
};

interface SessionListProps {
  sessions: Session[];
  selectedSessionId: number | null;
  onSelectSession: (sessionId: number) => void;
  animationKey?: number;
}

const PAGE_SIZE = 8;

// Format short date (e.g., "Jan 10, 14:30")
const formatShortDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

// Session card component with spring animation
const SessionCard = memo(function SessionCard({
  session,
  isSelected,
  onClick,
  animationDelay = 0,
  isAnimating = false,
  isCurrentSection = false,
}: {
  session: Session;
  isSelected: boolean;
  onClick: () => void;
  animationDelay?: number;
  isAnimating?: boolean;
  isCurrentSection?: boolean;
}) {
  const [currentX, setCurrentX] = useState(isAnimating ? -60 : 0);
  const [currentOpacity, setCurrentOpacity] = useState(isAnimating ? 0 : 1);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAnimating) {
      setCurrentX(0);
      setCurrentOpacity(1);
      return;
    }

    // Reset state for new animation
    setCurrentX(-60);
    setCurrentOpacity(0);

    const timeout = setTimeout(() => {
      // Spring physics parameters
      const stiffness = 120;
      const damping = 14;
      const mass = 1;

      let velocity = 0;
      let position = -60;
      const targetPosition = 0;

      const animate = () => {
        const displacement = position - targetPosition;
        const springForce = -stiffness * displacement;
        const dampingForce = -damping * velocity;
        const acceleration = (springForce + dampingForce) / mass;

        velocity += acceleration * 0.016;
        position += velocity * 0.016;

        setCurrentX(position);
        setCurrentOpacity(Math.min(1, 1 - (Math.abs(position) / 60)));

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

  return (
    <div
      onClick={onClick}
      className={`
        px-3 py-2 cursor-pointer transition-colors border-b border-zinc-800/50 last:border-b-0
        flex items-center gap-3
        ${isCurrentSection ? 'rounded-b-lg' : ''}
        ${isSelected
          ? 'bg-accent-blue/10'
          : 'hover:bg-bg-card-hover'
        }
      `}
      style={{
        transform: `translateX(${currentX}px)`,
        opacity: currentOpacity,
        willChange: isAnimating ? 'transform, opacity' : 'auto',
      }}
    >
      {/* Status indicator - ring indicates selection */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${session.is_current ? 'bg-accent-green animate-pulse' : 'bg-zinc-500'} ${isSelected ? 'ring-2 ring-accent-blue ring-offset-1 ring-offset-bg-card' : ''}`} />

      {/* Date */}
      <span className="text-xs text-text-secondary w-28 flex-shrink-0">
        {formatShortDate(session.start_time)}
      </span>

      {/* User efficiency */}
      <span className="text-xs text-text-primary flex-1">
        <span className="text-text-muted">Efficiency:</span> {calculateEfficiency(session)}%
      </span>

      {/* Duration */}
      <span className="text-xs text-text-muted flex items-center gap-1 flex-shrink-0">
        <Clock size={11} />
        {formatDuration(session.duration_seconds)}
      </span>
    </div>
  );
});

export const SessionList = memo(function SessionList({
  sessions,
  selectedSessionId,
  onSelectSession,
  animationKey,
}: SessionListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const prevAnimationKeyRef = useRef<number | undefined>(undefined); // Start undefined to detect first animation

  // Trigger animation when animationKey changes
  useEffect(() => {
    // No animation key - skip animation
    if (animationKey === undefined) {
      return;
    }

    // Same key - skip animation
    if (animationKey === prevAnimationKeyRef.current) {
      return;
    }

    prevAnimationKeyRef.current = animationKey;
    setShouldAnimate(true);

    // Stop animation state after all cards have animated
    const timer = setTimeout(() => {
      setShouldAnimate(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [animationKey]);

  // Separate current and previous sessions
  const currentSession = useMemo(() => {
    return sessions.find(s => s.is_current) || null;
  }, [sessions]);

  const previousSessions = useMemo(() => {
    return sessions.filter(s => !s.is_current);
  }, [sessions]);

  // Pagination for previous sessions
  const totalPages = useMemo(() => Math.ceil(previousSessions.length / PAGE_SIZE), [previousSessions.length]);
  const paginatedPreviousSessions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return previousSessions.slice(start, start + PAGE_SIZE);
  }, [previousSessions, currentPage]);

  const handleExport = useCallback((format: ExportFormat) => {
    exportData(sessions, format, 'sessions');
  }, [sessions]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Current Session Section */}
      <div className="glass-card flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Play size={14} className="text-accent-green" />
            <h2 className="text-sm font-semibold text-text-primary">Current Session</h2>
          </div>
          {currentSession && (
            <span className="text-[10px] text-accent-green">Live</span>
          )}
        </div>

        {currentSession ? (
          <SessionCard
            session={currentSession}
            isSelected={selectedSessionId === currentSession.id}
            onClick={() => onSelectSession(currentSession.id)}
            animationDelay={0}
            isAnimating={shouldAnimate}
            isCurrentSection={true}
          />
        ) : (
          <div className="flex items-center justify-center py-3 text-xs bg-red-500/5">
            <Square size={12} className="mr-2 text-red-400 opacity-70" />
            <span className="text-red-400">Application is closed</span>
          </div>
        )}
      </div>

      {/* Previous Sessions Section */}
      <div className="glass-card flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <History size={14} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Previous Sessions</h2>
            <span className="text-[10px] text-text-muted bg-zinc-800 px-1.5 py-0.5 rounded-full">
              {previousSessions.length}
            </span>
          </div>
          <Select
            value=""
            onChange={(value) => handleExport(value as ExportFormat)}
            options={[
              { value: 'csv', label: 'Export CSV' },
              { value: 'json', label: 'Export JSON' },
            ]}
            placeholder="Export"
            className="w-24"
          />
        </div>

        {/* Previous sessions list */}
        <div className="flex-1 overflow-auto min-h-[300px]">
          {paginatedPreviousSessions.map((session, index) => (
            <SessionCard
              key={session.id}
              session={session}
              isSelected={selectedSessionId === session.id}
              onClick={() => onSelectSession(session.id)}
              animationDelay={shouldAnimate ? (index + 1) * 50 : 0}
              isAnimating={shouldAnimate}
            />
          ))}

          {previousSessions.length === 0 && (
            <div className="flex items-center justify-center h-full py-6 text-text-muted text-xs">
              <History size={16} className="mr-2 opacity-50" />
              <span>No previous sessions</span>
            </div>
          )}
        </div>

        {/* Pagination */}
        {previousSessions.length > PAGE_SIZE && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={PAGE_SIZE}
            totalItems={previousSessions.length}
          />
        )}
      </div>
    </div>
  );
});
