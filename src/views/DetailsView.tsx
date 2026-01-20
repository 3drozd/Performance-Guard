import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { SessionList, SessionStats, PerformanceChart } from '../components/details';
import { AnimatedContainer, AnimatedItem } from '../components/common';
import type { AppSummary, Session, PerformanceSnapshot } from '../types';

interface DetailsViewProps {
  apps: AppSummary[];
  sessions: Session[];
  selectedAppName: string | null;
  onSelectApp: (appName: string) => void;
  performanceData: { [appName: string]: PerformanceSnapshot[] };
  isActive: boolean;
  initiallyHidden?: boolean;
}

export function DetailsView({
  apps,
  sessions,
  selectedAppName,
  onSelectApp,
  performanceData,
  isActive,
  initiallyHidden = false,
}: DetailsViewProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // Animation state for app change transitions
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [chartAnimationKey, setChartAnimationKey] = useState(0);
  const prevAppRef = useRef(selectedAppName);
  const prevSessionRef = useRef<number | null>(null);

  // Filter sessions for selected app
  const appSessions = useMemo(() => {
    if (!selectedAppName) return [];
    return sessions.filter(s => s.app_name === selectedAppName);
  }, [sessions, selectedAppName]);

  // Get selected session
  const selectedSession = useMemo(() => {
    return appSessions.find(s => s.id === selectedSessionId) || null;
  }, [appSessions, selectedSessionId]);

  // Get performance data - use live data for current session, or session history for ended sessions
  const chartData = useMemo(() => {
    // If we have a selected session that's not current, use its stored performance history
    if (selectedSession && !selectedSession.is_current && selectedSession.performance_history) {
      return selectedSession.performance_history;
    }
    // For current session or no selection, use live data
    if (!selectedAppName) return [];
    return performanceData[selectedAppName] || [];
  }, [performanceData, selectedAppName, selectedSession]);

  // Check if we're viewing a historical session
  const isViewingHistory = selectedSession && !selectedSession.is_current;

  // Auto-select first session when app changes
  useEffect(() => {
    if (appSessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(appSessions[0].id);
    }
  }, [appSessions, selectedSessionId]);

  // Trigger chart animation when session changes
  useEffect(() => {
    if (selectedSessionId !== null && selectedSessionId !== prevSessionRef.current) {
      setChartAnimationKey(k => k + 1);
      prevSessionRef.current = selectedSessionId;
    }
  }, [selectedSessionId]);

  // Handle app change - trigger fade out/in transition
  useEffect(() => {
    if (selectedAppName !== prevAppRef.current) {
      if (prevAppRef.current !== null) {
        // Changing from one app to another - fade out first
        setIsTransitioning(true);

        const timer = setTimeout(() => {
          setAnimationKey(k => k + 1);
          setChartAnimationKey(k => k + 1);
          setIsTransitioning(false);
          setSelectedSessionId(null);
        }, 200); // 200ms fade out

        prevAppRef.current = selectedAppName;
        return () => clearTimeout(timer);
      } else if (selectedAppName !== null) {
        // First app selection - trigger animation immediately (no fade out needed)
        setAnimationKey(k => k + 1);
        setChartAnimationKey(k => k + 1);
        setSelectedSessionId(null);
        prevAppRef.current = selectedAppName;
      }
    }
  }, [selectedAppName]);

  const handleSelectSession = useCallback((sessionId: number) => {
    setSelectedSessionId(sessionId);
  }, []);

  return (
    <AnimatedContainer
      isActive={isActive}
      staggerDelay={100}
      initialDelay={100}
      className="flex flex-col gap-4 p-6 h-full overflow-hidden"
      initiallyHidden={initiallyHidden}
    >
      {/* Session stats with integrated app selector */}
      <AnimatedItem className="overflow-visible relative z-20">
        <SessionStats
          session={selectedSession}
          apps={apps}
          selectedApp={selectedAppName}
          onSelectApp={onSelectApp}
          animationKey={chartAnimationKey}
        />
      </AnimatedItem>

      {/* Charts and session list - with fade transition */}
      <AnimatedItem className="flex-1 grid grid-cols-[minmax(500px,1fr)_320px] xl:grid-cols-[minmax(500px,1fr)_380px] gap-4 min-h-0">
        {/* Charts */}
        <div
          className="flex flex-col gap-4 overflow-auto scrollbar-stable transition-opacity duration-200"
          style={{ opacity: isTransitioning ? 0 : 1 }}
        >
          {!selectedAppName ? (
            <div className="flex-1 flex items-center justify-center glass-card">
              <p className="text-text-muted">Select an application to view detailed performance data</p>
            </div>
          ) : (
            <>
              {chartData.length > 0 ? (
                <PerformanceChart
                  data={chartData}
                  label={isViewingHistory ? "Resource Usage (%) - Session History" : "Resource Usage (%)"}
                  isActive={isActive}
                  animationKey={chartAnimationKey}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center glass-card">
                  <p className="text-text-muted">
                    {isViewingHistory ? "No performance data saved for this session" : "Waiting for performance data..."}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Session list - responsive width with fade transition */}
        <div
          className="min-h-0 overflow-hidden transition-opacity duration-200"
          style={{ opacity: isTransitioning ? 0 : 1 }}
        >
          <SessionList
            sessions={appSessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={handleSelectSession}
            animationKey={animationKey}
          />
        </div>
      </AnimatedItem>
    </AnimatedContainer>
  );
}
