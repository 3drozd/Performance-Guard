import { useState, useCallback, useEffect, useRef } from 'react';

const MIN_DISPLAY_TIME = 1000; // Minimum splash display time in ms

// Progress weights
const WEIGHTS = {
  appData: 0.4,      // 40%
  systemData: 0.4,   // 40%
  minDelay: 0.2,     // 20%
};

interface LoadingProgress {
  progress: number;
  isComplete: boolean;
  markAppDataLoaded: () => void;
  markSystemDataLoaded: () => void;
}

export function useLoadingProgress(): LoadingProgress {
  const [appDataLoaded, setAppDataLoaded] = useState(false);
  const [systemDataLoaded, setSystemDataLoaded] = useState(false);
  const [minDelayPassed, setMinDelayPassed] = useState(false);
  const [timeProgress, setTimeProgress] = useState(0);

  const startTimeRef = useRef(performance.now());
  const animationFrameRef = useRef<number | null>(null);

  // Animate the time-based progress smoothly
  useEffect(() => {
    const animate = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const progress = Math.min(elapsed / MIN_DISPLAY_TIME, 1);

      setTimeProgress(progress);

      if (progress >= 1) {
        setMinDelayPassed(true);
      } else {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const markAppDataLoaded = useCallback(() => {
    setAppDataLoaded(true);
  }, []);

  const markSystemDataLoaded = useCallback(() => {
    setSystemDataLoaded(true);
  }, []);

  // Calculate overall progress
  const progress =
    (appDataLoaded ? WEIGHTS.appData : 0) +
    (systemDataLoaded ? WEIGHTS.systemData : 0) +
    (timeProgress * WEIGHTS.minDelay);

  // Complete when all conditions are met
  const isComplete = appDataLoaded && systemDataLoaded && minDelayPassed;

  return {
    progress,
    isComplete,
    markAppDataLoaded,
    markSystemDataLoaded,
  };
}
