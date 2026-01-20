import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { ProcessRow } from './ProcessRow';
import { SearchInput, Button } from '../common';
import { getAppIcon } from '../../api/tauri';
import type { ProcessInfo } from '../../types';

interface ProcessListProps {
  processes: ProcessInfo[];
  whitelistedNames: Set<string>;
  onToggleWhitelist: (processName: string) => void;
  onRefresh: () => void;
  isActive: boolean;
}

const ANIMATION_INITIAL_DELAY_MS = 200; // Initial delay before animation starts
const ANIMATION_DELAY_MS = 80; // Delay between each process animation
const VISIBLE_ANIMATED_COUNT = 8; // Only animate first ~8 visible items

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
    return null; // Filter out if no clear base name
  }
  // Setup with .tmp
  if (lowerName.includes('setup') && lowerName.includes('.tmp')) {
    const setupMatch = lowerName.match(/^(.+?)setup/i);
    if (setupMatch && setupMatch[1].length > 1) return setupMatch[1];
    return null;
  }
  return null;
};

export const ProcessList = memo(function ProcessList({
  processes,
  whitelistedNames,
  onToggleWhitelist,
  onRefresh,
  isActive,
}: ProcessListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [glowIndex, setGlowIndex] = useState(-1);
  const [animationComplete, setAnimationComplete] = useState(false); // Track if animation finished
  const [processIcons, setProcessIcons] = useState<{ [name: string]: string }>({});
  const prevActiveRef = useRef(false);
  const waitingForProcessesRef = useRef(false); // Track if we're waiting for processes to load
  const processKeyRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const iconFetchedRef = useRef<Set<string>>(new Set());

  // Deduplicate and aggregate processes by name, merging helper subprocesses into main process
  const uniqueProcesses = useMemo(() => {
    const processMap = new Map<string, ProcessInfo>();

    // First pass: add all main processes
    processes.forEach(p => {
      const mainName = getMainProcessName(p.name);
      if (!mainName) {
        // This is a main process
        const key = p.name.toLowerCase();
        const existing = processMap.get(key);
        if (existing) {
          // Aggregate multiple instances of same process
          processMap.set(key, {
            ...existing,
            cpu_percent: existing.cpu_percent + p.cpu_percent,
            memory_mb: existing.memory_mb + p.memory_mb,
            memory_percent: existing.memory_percent + p.memory_percent,
          });
        } else {
          processMap.set(key, { ...p });
        }
      }
    });

    // Second pass: aggregate helper subprocesses into their main process
    processes.forEach(p => {
      const mainName = getMainProcessName(p.name);
      if (mainName) {
        const key = mainName.toLowerCase();
        const existing = processMap.get(key);
        if (existing) {
          // Add helper's resources to main process
          processMap.set(key, {
            ...existing,
            cpu_percent: existing.cpu_percent + p.cpu_percent,
            memory_mb: existing.memory_mb + p.memory_mb,
            memory_percent: existing.memory_percent + p.memory_percent,
          });
        }
        // If main process doesn't exist, skip the helper (orphan helper)
      }
    });

    return Array.from(processMap.values());
  }, [processes]);

  // Filter processes
  const filteredProcesses = useMemo(() => {
    if (!searchQuery) return uniqueProcesses;
    const query = searchQuery.toLowerCase();
    return uniqueProcesses.filter(p => p.name.toLowerCase().includes(query));
  }, [uniqueProcesses, searchQuery]);

  // Fetch icons for processes with exe_path
  useEffect(() => {
    uniqueProcesses.forEach(process => {
      if (process.exe_path && !iconFetchedRef.current.has(process.name)) {
        iconFetchedRef.current.add(process.name);
        getAppIcon(process.exe_path).then(icon => {
          if (icon) {
            setProcessIcons(prev => ({ ...prev, [process.name]: icon }));
          }
        });
      }
    });
  }, [uniqueProcesses]);

  // Start animation when view becomes active (every tab switch)
  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      // View just became active - wait for processes or start animation
      if (processes.length > 0) {
        // Scroll to top before starting animation
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
        processKeyRef.current += 1;
        setIsAnimating(true);
        setAnimationComplete(false);
        setGlowIndex(-1);
        waitingForProcessesRef.current = false;
      } else {
        // Processes not loaded yet - wait for them, but ensure content is visible
        waitingForProcessesRef.current = true;
        // Set animationComplete to true as fallback so showProcesses works
        setAnimationComplete(true);
      }
    } else if (!isActive && prevActiveRef.current) {
      // View became inactive - reset for next activation
      setAnimationComplete(false);
      setIsAnimating(false);
    }
    prevActiveRef.current = isActive;
  }, [isActive, processes.length]);

  // Start animation when processes load (if we were waiting)
  useEffect(() => {
    if (waitingForProcessesRef.current && processes.length > 0 && isActive) {
      // Scroll to top before starting animation
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      processKeyRef.current += 1;
      setIsAnimating(true);
      setAnimationComplete(false);
      setGlowIndex(-1);
      waitingForProcessesRef.current = false;
    }
  }, [processes.length, isActive]);

  // Calculate how many items should be animated (visible ones only)
  const lastAnimatedIndex = Math.min(VISIBLE_ANIMATED_COUNT - 1, filteredProcesses.length - 1);

  // Handle animation complete for a specific index
  const handleAnimationComplete = useCallback((index: number) => {
    // Set glow to this item immediately when it finishes animating
    setGlowIndex(index);

    // Check if this is the last animated item - hide glow after delay
    if (index >= lastAnimatedIndex) {
      setIsAnimating(false);
      setAnimationComplete(true);
      // Hide glow after animation ends
      setTimeout(() => {
        setGlowIndex(-1);
      }, 400);
    }
  }, [lastAnimatedIndex]);

  const handleRefresh = useCallback(() => {
    // Scroll to top before starting animation
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    // Clear icon cache to force re-fetch
    iconFetchedRef.current.clear();
    setProcessIcons({});
    // Reset and restart animation
    processKeyRef.current += 1;
    setIsAnimating(true);
    setAnimationComplete(false);
    setGlowIndex(-1);
    onRefresh();
  }, [onRefresh]);

  // Determine if processes should be shown
  // Only show when animation has started or completed - hidden during initial delay
  const showProcesses = isAnimating || animationComplete;

  return (
    <div className="glass-card flex flex-col h-full min-w-[340px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-text-primary flex-shrink-0 mr-4">Running<br />Processes</h2>
        <div className="flex items-center gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search processes..."
          />
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Process list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 p-4 overflow-y-scroll overflow-x-hidden"
        style={{
          pointerEvents: isAnimating ? 'none' : 'auto',
        }}
        onWheel={isAnimating ? (e) => e.preventDefault() : undefined}
      >
        <div className="flex flex-col gap-2">
          {showProcesses && filteredProcesses.map((process, index) => {
            const isInAnimatedRange = index <= lastAnimatedIndex;
            const shouldAnimate = isAnimating && isInAnimatedRange;
            // Hide non-animated items until animation completes
            const shouldHide = isAnimating && !isInAnimatedRange;

            if (shouldHide) {
              return null;
            }

            return (
              <ProcessRow
                key={`${processKeyRef.current}-${process.pid}`}
                process={process}
                icon={processIcons[process.name]}
                isWhitelisted={whitelistedNames.has(process.name)}
                onToggleWhitelist={onToggleWhitelist}
                animationDelay={shouldAnimate ? ANIMATION_INITIAL_DELAY_MS + index * ANIMATION_DELAY_MS : 0}
                isAnimating={shouldAnimate}
                showGlow={glowIndex === index}
                onAnimationComplete={shouldAnimate ? () => handleAnimationComplete(index) : undefined}
              />
            );
          })}
          {showProcesses && filteredProcesses.length === 0 && (
            <div className="flex items-center justify-center h-32 text-text-muted">
              No processes found
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
