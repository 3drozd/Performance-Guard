import { memo, useEffect, useState, useRef } from 'react';

interface LightningBoltProps {
  isActive: boolean;
  onComplete?: () => void;
}

export const LightningBolt = memo(function LightningBolt({
  isActive,
  onComplete,
}: LightningBoltProps) {
  const [opacity, setOpacity] = useState(0);
  const [scale, setScale] = useState(0.8);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (isActive) {
      const startTime = performance.now();
      const duration = 250; // 250ms animation

      // Ease-in function: accelerates over time
      const easeIn = (t: number) => t * t;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const linearProgress = Math.min(elapsed / duration, 1);

        if (linearProgress < 0.4) {
          // 0-40%: fade in and scale up (slower start due to ease-in)
          const p = linearProgress / 0.4;
          setOpacity(easeIn(p));
          setScale(0.8 + 0.3 * easeIn(p)); // 0.8 -> 1.1
        } else {
          // 40-100%: fade out and scale down (faster end)
          const p = (linearProgress - 0.4) / 0.6;
          setOpacity(1 - easeIn(p));
          setScale(1.1 - 0.1 * p); // 1.1 -> 1.0
        }

        if (linearProgress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          onComplete?.();
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        style={{
          position: 'absolute',
          transform: `rotate(-15deg) scale(${scale})`,
          opacity,
        }}
      >
        <defs>
          {/* Gradient pioruna: biały (lewy górny) → niebieski (prawy dolny) */}
          <linearGradient id="bolt-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>

          {/* Filtr rozmycia dla poświaty */}
          <filter id="bolt-blur" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
          </filter>
        </defs>

        {/* Poświata - rozmyta kopia z gradientem */}
        <path
          d="M 60 0 L 55 35 L 70 40 L 50 65 L 65 70 L 45 100 L 55 68 L 40 63 L 60 38 L 45 33 L 60 0"
          fill="url(#bolt-gradient)"
          filter="url(#bolt-blur)"
          opacity="0.9"
        />
        <path
          d="M 60 0 L 55 35 L 70 40 L 50 65 L 65 70 L 45 100 L 55 68 L 40 63 L 60 38 L 45 33 L 60 0"
          fill="url(#bolt-gradient)"
          filter="url(#bolt-blur)"
          opacity="0.7"
        />
        {/* Główny piorun */}
        <path
          d="M 60 0 L 55 35 L 70 40 L 50 65 L 65 70 L 45 100 L 55 68 L 40 63 L 60 38 L 45 33 L 60 0"
          fill="url(#bolt-gradient)"
        />
      </svg>
    </div>
  );
});
