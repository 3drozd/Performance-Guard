import { useState, useCallback, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Header } from './components/layout';
import { UpdateNotification } from './components/common';
import { DashboardView, WhitelistView, DetailsView, SettingsView } from './views';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useFirestoreSync } from './hooks/useFirestoreSync';
import { getProcesses, getSystemStats, saveAppData, loadAppData, signalAppReady, getAppIcon, getGlobalActivity } from './api/tauri';
import type { ViewType, WhitelistEntry, ProcessInfo, SystemStats, AppSummary, Session, PerformanceSnapshot } from './types';

// Track session data for each app
interface SessionTracker {
  [appName: string]: {
    currentSession: Session | null;
    sessions: Session[];
    cpuSamples: number[];
    memorySamples: number[];
    gpuSamples: number[];
    performanceHistory: PerformanceSnapshot[]; // Real-time performance data for charts
    notRunningCount: number; // Counter for grace period before ending session
  };
}

const MAX_PERFORMANCE_POINTS = 1800; // Keep last 1800 data points (1 hour at 2s interval)

// Extract main process name from helper subprocess (e.g., "opera" from "opera_crashreporter")
// Returns null if this is not a helper subprocess
const getMainProcessName = (name: string): string | null => {
  const lowerName = name.toLowerCase();
  // Pattern: appname_helper, appname_crashreporter, etc.
  const underscoreMatch = lowerName.match(/^(.+?)_(crashreporter|helper|utility|gpu|renderer)/);
  if (underscoreMatch && underscoreMatch[1].length > 1) return underscoreMatch[1];
  // Setup patterns with hash - extract base name (e.g., "Code" from "CodeSetup-stable-585eba...")
  if (/setup.*-[a-f0-9]{10,}/i.test(lowerName)) {
    const setupMatch = lowerName.match(/^(.+?)setup/i);
    if (setupMatch && setupMatch[1].length > 1) return setupMatch[1];
    return null;
  }
  // Setup with .tmp
  if (lowerName.includes('setup') && lowerName.includes('.tmp')) {
    const setupMatch = lowerName.match(/^(.+?)setup/i);
    if (setupMatch && setupMatch[1].length > 1) return setupMatch[1];
    return null;
  }
  return null;
};

// Aggregated process with all PIDs from main + helper processes
interface AggregatedProcess extends ProcessInfo {
  allPids: number[];
}

// Aggregate helper subprocess resources into main process, collecting all PIDs
const aggregateProcesses = (procs: ProcessInfo[]): Map<string, AggregatedProcess> => {
  const processMap = new Map<string, AggregatedProcess>();

  // First pass: add all main processes with their PIDs
  procs.forEach(p => {
    const mainName = getMainProcessName(p.name);
    if (!mainName) {
      const key = p.name.toLowerCase();
      const existing = processMap.get(key);
      if (existing) {
        processMap.set(key, {
          ...existing,
          cpu_percent: existing.cpu_percent + p.cpu_percent,
          memory_mb: existing.memory_mb + p.memory_mb,
          memory_percent: existing.memory_percent + p.memory_percent,
          gpu_percent: (existing.gpu_percent || 0) + (p.gpu_percent || 0),
          allPids: [...existing.allPids, p.pid],
        });
      } else {
        processMap.set(key, { ...p, allPids: [p.pid] });
      }
    }
  });

  // Second pass: aggregate helper subprocesses and their PIDs into main process
  procs.forEach(p => {
    const mainName = getMainProcessName(p.name);
    if (mainName) {
      const key = mainName.toLowerCase();
      const existing = processMap.get(key);
      if (existing) {
        processMap.set(key, {
          ...existing,
          cpu_percent: existing.cpu_percent + p.cpu_percent,
          memory_mb: existing.memory_mb + p.memory_mb,
          memory_percent: existing.memory_percent + p.memory_percent,
          gpu_percent: (existing.gpu_percent || 0) + (p.gpu_percent || 0),
          allPids: [...existing.allPids, p.pid],
        });
      }
    }
  });

  return processMap;
};

function AppContent() {
  const { user, isOnline } = useAuth();
  const firestoreSync = useFirestoreSync(user?.uid ?? null);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [selectedAppName, setSelectedAppName] = useState<string | null>(null);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    cpu_percent: 0,
    memory_percent: 0,
    total_memory_gb: 0,
    used_memory_gb: 0,
    available_memory_gb: 0,
    cpu_cores: 0,
  });
  const [appSummaries, setAppSummaries] = useState<AppSummary[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [performanceData, setPerformanceData] = useState<{ [appName: string]: PerformanceSnapshot[] }>({});

  const [appDataLoaded, setAppDataLoaded] = useState(false);
  const [systemDataLoaded, setSystemDataLoaded] = useState(false);
  const [initialAnimationReady, setInitialAnimationReady] = useState(false);
  const [appIcons, setAppIcons] = useState<{ [appName: string]: string }>({});

  const sessionTrackerRef = useRef<SessionTracker>({});
  const nextSessionIdRef = useRef(1);
  const isInitializedRef = useRef(false);
  const previousSessionsRef = useRef<Session[]>([]);
  const appReadySignaledRef = useRef(false);
  const iconFetchedRef = useRef<Set<string>>(new Set());
  const firestoreSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Signal app ready when both data sources are loaded
  useEffect(() => {
    if (appDataLoaded && systemDataLoaded && !appReadySignaledRef.current) {
      appReadySignaledRef.current = true;
      // Give React time to render UI before signaling
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          signalAppReady().catch(() => {});
        });
      });
    }
  }, [appDataLoaded, systemDataLoaded]);

  // Listen for panel animation trigger from splash screen
  useEffect(() => {
    // If app was already initialized (e.g., after system wake), enable animations immediately
    if (isInitializedRef.current && !initialAnimationReady) {
      setInitialAnimationReady(true);
      return;
    }

    const unlistenPromise = listen('trigger-panel-animation', () => {
      // Small delay to ensure window is fully visible
      setTimeout(() => {
        setInitialAnimationReady(true);
      }, 50);
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [initialAnimationReady]);

  // Load saved data on startup
  useEffect(() => {
    // If ref says initialized but appDataLoaded is false, state was lost (e.g., after system wake)
    // In this case, allow reloading data
    if (isInitializedRef.current && appDataLoaded) {
      return; // Already initialized and data is loaded - skip
    }

    // Mark as initialized (or re-initializing)
    isInitializedRef.current = true;

    const loadData = async () => {
      try {
        // Always load local data first
        const localData = await loadAppData();

        let finalWhitelist = localData.whitelist;
        let finalSessions = localData.sessions;
        let finalNextSessionId = localData.nextSessionId;

        // If user is logged in and online, merge with cloud data
        if (user && isOnline) {
          try {
            const [cloudWhitelist, cloudSessions] = await Promise.all([
              firestoreSync.loadWhitelist(),
              firestoreSync.loadSessions()
            ]);

            // Merge local and cloud data
            const merged = firestoreSync.mergeData(
              localData.whitelist,
              cloudWhitelist,
              localData.sessions,
              cloudSessions
            );

            finalWhitelist = merged.whitelist;
            finalSessions = merged.sessions;
            finalNextSessionId = merged.nextSessionId;

            // Save merged data back to both local and cloud
            // Only save if we have data (safety check)
            if (finalWhitelist.length > 0 || finalSessions.length > 0) {
              await saveAppData(finalWhitelist, finalSessions, finalNextSessionId);
              await firestoreSync.saveWhitelist(finalWhitelist);
              await firestoreSync.saveSessions(finalSessions);
            }
          } catch {
            // Continue with local data only
          }
        }

        setWhitelist(finalWhitelist);
        nextSessionIdRef.current = finalNextSessionId;

        // Initialize session tracker with saved sessions
        finalSessions.forEach(session => {
          const appNameLower = session.app_name.toLowerCase();
          if (!sessionTrackerRef.current[appNameLower]) {
            sessionTrackerRef.current[appNameLower] = {
              currentSession: null,
              sessions: [],
              cpuSamples: [],
              memorySamples: [],
              gpuSamples: [],
              performanceHistory: [],
              notRunningCount: 0,
            };
          }
          sessionTrackerRef.current[appNameLower].sessions.push(session);
        });

        previousSessionsRef.current = finalSessions;
        setSessions(finalSessions);
        setAppDataLoaded(true);
      } catch {
        setAppDataLoaded(true);
      }
    };

    loadData();
  }, [user, isOnline, firestoreSync, appDataLoaded]);

  // Fetch processes (only on demand for whitelist view)
  const fetchProcesses = useCallback(async () => {
    try {
      const procs = await getProcesses();
      setProcesses(procs);
    } catch {
      // Ignore fetch errors
    }
  }, []);

  // Fetch real system data and track sessions
  const fetchSystemData = useCallback(async () => {
    const [procs, stats] = await Promise.all([
      getProcesses(),
      getSystemStats(),
    ]);

    // Ignore empty process list (can happen after system wake)
    // Keep previous data instead of updating with empty state
    if (procs.length === 0) {
      return;
    }

      setSystemStats(stats);

      // Mark system data as loaded (only once)
      setSystemDataLoaded(true);

      // Track sessions for whitelisted apps
      if (whitelist.length > 0) {
        const tracker = sessionTrackerRef.current;
        const now = new Date();

        // Initialize tracker for new whitelist entries
        whitelist.forEach(w => {
          const name = w.name.toLowerCase();
          if (!tracker[name]) {
            tracker[name] = {
              currentSession: null,
              sessions: [],
              cpuSamples: [],
              memorySamples: [],
              gpuSamples: [],
              performanceHistory: [],
              notRunningCount: 0,
            };
          }
        });

        // Aggregate all processes once (including helper subprocesses with all PIDs)
        const aggregatedProcs = aggregateProcesses(procs);

        // Get global activity ONCE per cycle (resets counters)
        const globalActivity = await getGlobalActivity();

        // Check each whitelisted app
        for (const w of whitelist) {
          const appName = w.name;
          const appNameLower = appName.toLowerCase();

          // Ensure tracker exists for this app
          if (!tracker[appNameLower]) {
            tracker[appNameLower] = {
              currentSession: null,
              sessions: [],
              cpuSamples: [],
              memorySamples: [],
              gpuSamples: [],
              performanceHistory: [],
              notRunningCount: 0,
            };
          }

          const appTracker = tracker[appNameLower];

          // Find if this app is running (use pre-aggregated processes map)
          // Try exact match first, then partial match for .exe variants
          let aggregatedProc = aggregatedProcs.get(appNameLower);

          // If no exact match, try without .exe extension or with it
          if (!aggregatedProc) {
            const nameWithoutExt = appNameLower.replace(/\.exe$/i, '');
            const nameWithExt = nameWithoutExt + '.exe';
            aggregatedProc = aggregatedProcs.get(nameWithoutExt) || aggregatedProcs.get(nameWithExt);
          }

          // Convert to array for compatibility with existing code
          const runningProcs = aggregatedProc ? [aggregatedProc] : [];

          const isRunning = runningProcs.length > 0;

          if (isRunning) {
            // Reset grace period counter - app is running
            appTracker.notRunningCount = 0;

            // Sum all processes of the app (with corrected memory values from Rust backend)
            const totalCpu = Math.min(100, runningProcs.reduce((sum, p) => sum + p.cpu_percent, 0));
            const totalMemory = runningProcs.reduce((sum, p) => sum + p.memory_mb, 0);
            const totalMemoryPercent = Math.min(100, runningProcs.reduce((sum, p) => sum + p.memory_percent, 0));
            const totalGpu = Math.min(100, runningProcs.reduce((sum, p) => sum + (p.gpu_percent || 0), 0));

            // Check if this app is in foreground (compare foreground PID with all PIDs including helpers)
            const pids = aggregatedProc?.allPids || [];
            const isForeground = globalActivity.foreground_pid !== null && pids.includes(globalActivity.foreground_pid);

            // App gets activity only if it's in foreground
            const activityPercent = isForeground ? globalActivity.activity_percent : 0;

            // Add performance snapshot with raw activity data
            const snapshot: PerformanceSnapshot = {
              timestamp: now.toISOString(),
              cpu_percent: totalCpu,
              memory_mb: totalMemory,
              memory_percent: totalMemoryPercent,
              gpu_percent: totalGpu,
              user_activity_percent: activityPercent,
              is_foreground: isForeground,
              keyboard_clicks: isForeground ? globalActivity.keyboard_clicks : 0,
              mouse_pixels: isForeground ? globalActivity.mouse_pixels : 0,
            };
            appTracker.performanceHistory.push(snapshot);

            // Keep only last MAX_PERFORMANCE_POINTS
            if (appTracker.performanceHistory.length > MAX_PERFORMANCE_POINTS) {
              appTracker.performanceHistory = appTracker.performanceHistory.slice(-MAX_PERFORMANCE_POINTS);
            }

            if (!appTracker.currentSession) {
              // Start new session
              const newSessionId = nextSessionIdRef.current++;

              appTracker.currentSession = {
                id: newSessionId,
                app_name: appName,
                start_time: now.toISOString(),
                duration_seconds: 0,
                avg_cpu_percent: totalCpu,
                avg_memory_mb: totalMemory,
                avg_gpu_percent: totalGpu,
                peak_cpu_percent: totalCpu,
                peak_memory_mb: totalMemory,
                peak_gpu_percent: totalGpu,
                is_current: true,
                performance_history: [...appTracker.performanceHistory],
              };
              appTracker.cpuSamples = [totalCpu];
              appTracker.memorySamples = [totalMemory];
              appTracker.gpuSamples = [totalGpu];
            } else {
              // Update current session
              appTracker.cpuSamples.push(totalCpu);
              appTracker.memorySamples.push(totalMemory);
              appTracker.gpuSamples.push(totalGpu);

              const startTime = new Date(appTracker.currentSession.start_time);
              const durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

              const avgCpu = appTracker.cpuSamples.reduce((a, b) => a + b, 0) / appTracker.cpuSamples.length;
              const avgMemory = appTracker.memorySamples.reduce((a, b) => a + b, 0) / appTracker.memorySamples.length;
              const avgGpu = appTracker.gpuSamples.reduce((a, b) => a + b, 0) / appTracker.gpuSamples.length;
              const peakCpu = Math.max(...appTracker.cpuSamples);
              const peakMemory = Math.max(...appTracker.memorySamples);
              const peakGpu = Math.max(...appTracker.gpuSamples);

              appTracker.currentSession = {
                ...appTracker.currentSession,
                duration_seconds: durationSeconds,
                avg_cpu_percent: avgCpu,
                avg_memory_mb: avgMemory,
                avg_gpu_percent: avgGpu,
                peak_cpu_percent: peakCpu,
                peak_memory_mb: peakMemory,
                peak_gpu_percent: peakGpu,
                performance_history: [...appTracker.performanceHistory],
              };
            }
          } else {
            // App not running
            if (appTracker.currentSession) {
              // End session IMMEDIATELY (no grace period for now)
              // Save the performance history with this session
              const endedSession: Session = {
                ...appTracker.currentSession,
                end_time: now.toISOString(),
                is_current: false,
                performance_history: [...appTracker.performanceHistory],
              };
              appTracker.sessions.unshift(endedSession);
              appTracker.currentSession = null;

              appTracker.cpuSamples = [];
              appTracker.memorySamples = [];
              appTracker.gpuSamples = [];
              appTracker.performanceHistory = [];
              appTracker.notRunningCount = 0;

              // Save data when session ends
              const allSessionsToSave: Session[] = [];
              Object.values(tracker).forEach(t => {
                allSessionsToSave.push(...t.sessions);
              });

              // Save locally
              saveAppData(whitelist, allSessionsToSave, nextSessionIdRef.current)
                .catch(() => {});

              // Sync to cloud if logged in
              if (user && isOnline) {
                firestoreSync.saveSessions(allSessionsToSave)
                  .catch(() => {});
              }
            }
          }
        }

        // Collect all sessions
        const allSessions: Session[] = [];
        Object.values(tracker).forEach(t => {
          if (t.currentSession) {
            allSessions.push(t.currentSession);
          }
          allSessions.push(...t.sessions);
        });
        setSessions(allSessions);

        // Collect performance data for all apps - create new array copies to trigger re-render
        const allPerformanceData: { [appName: string]: PerformanceSnapshot[] } = {};
        Object.entries(tracker).forEach(([appNameLower, t]) => {
          // Find original case name
          const entry = whitelist.find(w => w.name.toLowerCase() === appNameLower);
          if (entry) {
            // Create a new array copy to ensure React detects the change
            allPerformanceData[entry.name] = [...t.performanceHistory];
          }
        });
        setPerformanceData(allPerformanceData);

        // Update app summaries
        // Use same aggregated processes map for summaries
        const summaryAggregatedProcs = aggregateProcesses(procs);

        const newSummaries: AppSummary[] = whitelist.map(w => {
          const appNameLower = w.name.toLowerCase();
          const appTracker = tracker[appNameLower];

          // Use same matching logic as session tracking
          let summaryProc = summaryAggregatedProcs.get(appNameLower);
          if (!summaryProc) {
            const nameWithoutExt = appNameLower.replace(/\.exe$/i, '');
            const nameWithExt = nameWithoutExt + '.exe';
            summaryProc = summaryAggregatedProcs.get(nameWithoutExt) || summaryAggregatedProcs.get(nameWithExt);
          }

          const isRunning = !!summaryProc;
          const summaryProcs = summaryProc ? [summaryProc] : [];

          // Sum all processes (with corrected memory from Rust backend)
          let totalCpu = 0;
          let totalMemoryPercent = 0;
          let totalGpu = 0;
          if (isRunning) {
            totalCpu = Math.min(100, summaryProcs.reduce((sum, p) => sum + p.cpu_percent, 0));
            totalMemoryPercent = Math.min(100, summaryProcs.reduce((sum, p) => sum + p.memory_percent, 0));
            totalGpu = Math.min(100, summaryProcs.reduce((sum, p) => sum + p.gpu_percent, 0));
          }

          const sessionCount = (appTracker?.currentSession ? 1 : 0) + (appTracker?.sessions.length || 0);
          const exePath = summaryProcs[0]?.exe_path || w.exe_path;

          // Fetch icon if we have exe path and haven't fetched yet
          if (exePath && !iconFetchedRef.current.has(w.name)) {
            iconFetchedRef.current.add(w.name);
            getAppIcon(exePath).then(icon => {
              if (icon) {
                setAppIcons(prev => ({ ...prev, [w.name]: icon }));
              }
            });
          }

          // Calculate time metrics from all sessions
          const allAppSessions = [
            ...(appTracker?.sessions || []),
            ...(appTracker?.currentSession ? [appTracker.currentSession] : [])
          ];

          let totalTimeSeconds = 0;
          let activeTimeSeconds = 0;
          let idleTimeSeconds = 0;
          let backgroundTimeSeconds = 0;
          let totalCpuSum = 0;
          let totalMemSum = 0;
          let totalGpuSum = 0;
          let sampleCount = 0;
          let activitySum = 0;
          let foregroundCount = 0;

          allAppSessions.forEach(session => {
            totalTimeSeconds += session.duration_seconds;

            // Calculate time categories from performance history
            if (session.performance_history && session.performance_history.length > 0) {
              session.performance_history.forEach(p => {
                if (p.is_foreground) {
                  // App is in foreground
                  if (p.user_activity_percent > 10) {
                    activeTimeSeconds += 2; // Active: foreground + activity
                  } else {
                    idleTimeSeconds += 2;   // Idle: foreground + no activity
                  }
                  // Accumulate activity for efficiency calculation
                  activitySum += p.user_activity_percent;
                  foregroundCount++;
                } else {
                  backgroundTimeSeconds += 2; // Background: app not in foreground
                }

                // Accumulate averages from history
                totalCpuSum += p.cpu_percent;
                totalMemSum += p.memory_percent;
                totalGpuSum += p.gpu_percent;
                sampleCount++;
              });
            } else {
              // Fallback to session averages if no history
              totalCpuSum += session.avg_cpu_percent;
              totalMemSum += (session.avg_memory_mb / 320); // Approximate memory %
              totalGpuSum += session.avg_gpu_percent;
              sampleCount++;
            }
          });

          // Calculate averages
          const avgCpu = sampleCount > 0 ? totalCpuSum / sampleCount : totalCpu;
          const avgMem = sampleCount > 0 ? totalMemSum / sampleCount : totalMemoryPercent;
          const avgGpu = sampleCount > 0 ? totalGpuSum / sampleCount : totalGpu;
          const avgUsage = (avgCpu + avgMem + avgGpu) / 3;

          // Efficiency = average user_activity_percent from foreground snapshots
          const efficiency = foregroundCount > 0 ? activitySum / foregroundCount : 0;

          return {
            name: w.name,
            session_count: sessionCount,
            is_running: isRunning,
            last_seen: isRunning ? now.toISOString() : (appTracker?.sessions[0]?.end_time || w.added_date),
            exe_path: exePath,
            icon: appIcons[w.name],
            // Time tracking
            total_time_seconds: totalTimeSeconds,
            active_time_seconds: activeTimeSeconds,
            idle_time_seconds: idleTimeSeconds,
            background_time_seconds: backgroundTimeSeconds,
            // Performance metrics
            avg_cpu_percent: avgCpu,
            avg_memory_percent: avgMem,
            avg_gpu_percent: avgGpu,
            avg_usage_percent: avgUsage,
            efficiency_percent: efficiency,
          };
        });

        setAppSummaries(newSummaries);
      }
      // Note: Don't clear data when whitelist is empty - preserve historical data
      // This prevents blank screen after system wake from sleep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whitelist, appIcons]);

  // Initial fetch and periodic updates for system stats
  useEffect(() => {
    fetchSystemData().catch(() => {}); // Ignore initial fetch errors
    const interval = setInterval(() => {
      fetchSystemData().catch(() => {}); // Ignore periodic fetch errors
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchSystemData]);

  // Handle visibility change (e.g., after system wake from sleep)
  useEffect(() => {
    let retryCount = 0;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Clear any pending retries
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeout = null;
        }
        retryCount = 0;

        // Trigger immediate data refresh with retry logic
        const attemptFetch = async () => {
          try {
            await fetchSystemData();
            retryCount = 0; // Success - reset counter
          } catch {
            // Retry with exponential backoff (max 5 retries, max 8 seconds delay)
            if (retryCount < 5) {
              retryCount++;
              const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 8000);
              retryTimeout = setTimeout(attemptFetch, delay);
            }
          }
        };

        attemptFetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [fetchSystemData]);

  // Fetch processes once when whitelist view becomes active
  useEffect(() => {
    if (activeView === 'whitelist') {
      fetchProcesses();
    }
  }, [activeView, fetchProcesses]);

  // Save data when whitelist changes
  useEffect(() => {
    // Don't save during initial load or before data is loaded (e.g., after system wake)
    if (!isInitializedRef.current || !appDataLoaded) return;

    const allSessionsToSave: Session[] = [];
    Object.values(sessionTrackerRef.current).forEach(t => {
      allSessionsToSave.push(...t.sessions);
    });

    // Save locally immediately
    saveAppData(whitelist, allSessionsToSave, nextSessionIdRef.current)
      .catch(() => {});

    // Sync whitelist to cloud with debounce (30 seconds)
    if (user && isOnline) {
      // Clear previous timer
      if (firestoreSyncTimeoutRef.current) {
        clearTimeout(firestoreSyncTimeoutRef.current);
      }

      // Set new timer - sync after 30 seconds of no changes
      firestoreSyncTimeoutRef.current = setTimeout(() => {
        firestoreSync.saveWhitelist(whitelist)
          .catch(() => {});
      }, 30000);
    }
  }, [whitelist, user, isOnline, firestoreSync, appDataLoaded]);

  // Cleanup Firestore sync timer on unmount
  useEffect(() => {
    return () => {
      if (firestoreSyncTimeoutRef.current) {
        clearTimeout(firestoreSyncTimeoutRef.current);
      }
    };
  }, []);

  // Handle view change
  const handleViewChange = useCallback((view: ViewType) => {
    setActiveView(view);
  }, []);

  // Handle app selection from dashboard
  const handleSelectApp = useCallback((appName: string) => {
    setSelectedAppName(appName);
    setActiveView('details');
  }, []);

  // Handle app selection in details view
  const handleSelectAppInDetails = useCallback((appName: string) => {
    setSelectedAppName(appName);
  }, []);

  // Whitelist management
  const handleToggleWhitelist = useCallback((processName: string) => {
    setWhitelist(prev => {
      const exists = prev.find(w => w.name === processName);
      if (exists) {
        // Remove from tracker when removing from whitelist
        delete sessionTrackerRef.current[processName.toLowerCase()];
        return prev.filter(w => w.name !== processName);
      }

      // Find the process to get exe_path
      const proc = processes.find(p => p.name === processName);

      const newEntry: WhitelistEntry = {
        id: Date.now(),
        name: processName,
        exe_path: proc?.exe_path,
        added_date: new Date().toISOString(),
        is_tracked: true,
      };
      return [...prev, newEntry];
    });
  }, [processes]);

  const handleRemoveFromWhitelist = useCallback((id: number) => {
    setWhitelist(prev => {
      const entry = prev.find(w => w.id === id);
      if (entry) {
        delete sessionTrackerRef.current[entry.name.toLowerCase()];
      }
      return prev.filter(w => w.id !== id);
    });
  }, []);

  const handleBrowse = useCallback(() => {
    // Browse for executable - not implemented yet
  }, []);

  const handleRefreshProcesses = useCallback(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      <Header activeView={activeView} onViewChange={handleViewChange} />

      <main className="flex-1 min-h-0 overflow-auto scrollbar-stable">
        <DashboardView
          apps={appSummaries}
          systemStats={systemStats}
          onSelectApp={handleSelectApp}
          isActive={activeView === 'dashboard' && initialAnimationReady}
          initiallyHidden={!initialAnimationReady}
        />

        <WhitelistView
          processes={processes}
          whitelist={whitelist}
          onToggleWhitelist={handleToggleWhitelist}
          onRemoveFromWhitelist={handleRemoveFromWhitelist}
          onBrowse={handleBrowse}
          onRefreshProcesses={handleRefreshProcesses}
          isActive={activeView === 'whitelist' && initialAnimationReady}
          initiallyHidden={!initialAnimationReady}
        />

        <DetailsView
          apps={appSummaries}
          sessions={sessions}
          selectedAppName={selectedAppName}
          onSelectApp={handleSelectAppInDetails}
          performanceData={performanceData}
          isActive={activeView === 'details' && initialAnimationReady}
          initiallyHidden={!initialAnimationReady}
        />

        <SettingsView
          isActive={activeView === 'settings' && initialAnimationReady}
          initiallyHidden={!initialAnimationReady}
        />
      </main>

      {/* Update notification toast */}
      <UpdateNotification />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
