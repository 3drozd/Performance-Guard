import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { ShieldIcon } from './ShieldIcon';
import { LightningBolt } from './LightningBolt';

type ExitPhase = 'idle' | 'lightning' | 'zoom' | 'complete';

interface SplashScreenProps {
  progress: number;
  isLoading: boolean;
  onExitComplete: () => void;
}

// Animation constants
const LIGHTNING_DURATION = 100;
const ZOOM_DURATION = 300;
const SCALE_START = 1.0;
const SCALE_END = 2.5;

// Ease-in quadratic curve (accelerating)
const easeInQuad = (t: number) => t * t;

export const SplashScreen = memo(function SplashScreen({
  isLoading,
  onExitComplete,
}: SplashScreenProps) {
  const [phase, setPhase] = useState<ExitPhase>('idle');
  const [scale, setScale] = useState(SCALE_START);
  const [opacity, setOpacity] = useState(1);
  const [flashOpacity, setFlashOpacity] = useState(0);

  const animationRef = useRef<number | null>(null);
  const zoomStartTimeRef = useRef<number | null>(null);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Start exit sequence when loading completes
  useEffect(() => {
    if (!isLoading && phase === 'idle') {
      setPhase('lightning');
      setFlashOpacity(0.6);

      // Flash fade out
      const fadeFlash = () => {
        setFlashOpacity((prev) => Math.max(0, prev - 0.1));
      };
      const flashInterval = setInterval(fadeFlash, 15);
      setTimeout(() => clearInterval(flashInterval), LIGHTNING_DURATION);
    }
  }, [isLoading, phase]);

  // Handle lightning completion -> start zoom
  const handleLightningComplete = useCallback(() => {
    setPhase('zoom');
    zoomStartTimeRef.current = performance.now();

    const animateZoom = () => {
      if (!zoomStartTimeRef.current) return;

      const elapsed = performance.now() - zoomStartTimeRef.current;
      const t = Math.min(elapsed / ZOOM_DURATION, 1);
      const easedT = easeInQuad(t);

      // Scale from 1.0 to 2.5
      const newScale = SCALE_START + (SCALE_END - SCALE_START) * easedT;
      setScale(newScale);

      // Fade out opacity
      setOpacity(1 - easedT);

      if (t < 1) {
        animationRef.current = requestAnimationFrame(animateZoom);
      } else {
        setPhase('complete');
        onExitComplete();
      }
    };

    animationRef.current = requestAnimationFrame(animateZoom);
  }, [onExitComplete]);

  // Don't render if complete
  if (phase === 'complete') {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary"
      style={{ opacity }}
    >
      {/* Screen flash overlay for lightning effect */}
      <div
        className="absolute inset-0 bg-blue-400 pointer-events-none transition-opacity"
        style={{ opacity: flashOpacity }}
      />

      {/* Shield with aura - scaled during zoom phase */}
      <div
        className="relative"
        style={{
          transform: `scale(${scale})`,
          willChange: phase === 'zoom' ? 'transform' : 'auto',
        }}
      >
        <ShieldIcon phase={phase === 'idle' ? 'pulsing' : phase} />

        {/* Lightning bolt overlay */}
        <LightningBolt
          isActive={phase === 'lightning'}
          onComplete={handleLightningComplete}
        />
      </div>
    </div>
  );
});
