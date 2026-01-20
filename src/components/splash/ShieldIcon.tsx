import { memo, useEffect, useState, useRef } from 'react';
import { AuroraRing } from './AuroraRing';

export interface ShieldIconProps {
  phase?: 'drawing' | 'aura-fadein' | 'pulsing' | 'lightning' | 'zoom';
  onDrawComplete?: () => void;
}

export const ShieldIcon = memo(function ShieldIcon({ phase, onDrawComplete }: ShieldIconProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawComplete, setDrawComplete] = useState(false);
  const onDrawCompleteRef = useRef(onDrawComplete);

  // Keep ref updated
  useEffect(() => {
    onDrawCompleteRef.current = onDrawComplete;
  }, [onDrawComplete]);

  // Shield drawing animation using CSS transition
  useEffect(() => {
    if (phase !== 'drawing') return;
    setIsDrawing(false);
    setDrawComplete(false);

    const delay = 400; // Delay before drawing starts
    const duration = 1400; // Match visual end of CSS ease-out transition (1.8s with ease-out ends visually earlier)

    // Start drawing after delay
    const startTimeout = setTimeout(() => {
      setIsDrawing(true);
    }, delay);

    // Mark complete and call callback after animation finishes
    const completeTimeout = setTimeout(() => {
      setDrawComplete(true);
      onDrawCompleteRef.current?.();
    }, delay + duration);

    return () => {
      clearTimeout(startTimeout);
      clearTimeout(completeTimeout);
    };
  }, [phase]);


  // Shield path length
  const pathLength = 1400;
  // CSS transition handles the animation - we just set target value
  const strokeDashoffset = isDrawing ? 0 : pathLength;

  // Aura is active when drawing is complete or in later phases
  const auraActive = phase !== 'drawing' || drawComplete;

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Aurora ring effect */}
      <AuroraRing size={200} isActive={auraActive} phase={phase} />

      {/* Shield SVG with stroke drawing animation */}
      <svg
        width="80"
        height="80"
        viewBox="0 0 512 512"
        fill="none"
        style={{
          position: 'relative',
          zIndex: 10,
          filter: isDrawing
            ? 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 15px rgba(147, 197, 253, 0.7)) drop-shadow(0 0 30px rgba(59, 130, 246, 0.5))'
            : 'none',
          transition: 'filter 0.3s ease-out',
          willChange: 'filter',
        }}
      >
        <defs>
          {/* Gradient dla głównej linii: biały → jasnoniebieski → niebieski */}
          <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#bfdbfe" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
          {/* Gradient dla glow */}
          <linearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>

        {/* Ghost shield - widoczna przed rysowaniem */}
        <path
          d="M 397 205 L 397 145 L 256 75 L 115 145 Q 115 285 115 320 Q 127 385 256 460 Q 385 385 397 320 Q 397 285 397 270 L 270 270"
          stroke="#3b82f6"
          strokeOpacity={0.1}
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x={378} y={186} width={38} height={38} rx={5} fill="#3b82f6" fillOpacity={0.1} />

        {/* Zewnętrzny glow - bez filtra blur, tylko szerszy stroke */}
        <path
          d="M 397 205 L 397 145 L 256 75 L 115 145 Q 115 285 115 320 Q 127 385 256 460 Q 385 385 397 320 Q 397 285 397 270 L 270 270"
          stroke="url(#glowGradient)"
          strokeWidth={24}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={strokeDashoffset}
          opacity={0.4}
          style={{
            transition: 'stroke-dashoffset 1.8s cubic-bezier(0.33, 1, 0.68, 1)',
            willChange: 'stroke-dashoffset',
          }}
        />
        <rect
          x={371}
          y={179}
          width={52}
          height={52}
          rx={7}
          fill="url(#glowGradient)"
          opacity={isDrawing ? 0.4 : 0}
          style={{
            transition: 'opacity 1.8s cubic-bezier(0.33, 1, 0.68, 1)',
          }}
        />

        {/* Średni glow */}
        <path
          d="M 397 205 L 397 145 L 256 75 L 115 145 Q 115 285 115 320 Q 127 385 256 460 Q 385 385 397 320 Q 397 285 397 270 L 270 270"
          stroke="#93c5fd"
          strokeWidth={14}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={strokeDashoffset}
          opacity={0.6}
          style={{
            transition: 'stroke-dashoffset 1.8s cubic-bezier(0.33, 1, 0.68, 1)',
            willChange: 'stroke-dashoffset',
          }}
        />
        <rect
          x={374}
          y={182}
          width={46}
          height={46}
          rx={6}
          fill="#93c5fd"
          opacity={isDrawing ? 0.6 : 0}
          style={{
            transition: 'opacity 1.8s cubic-bezier(0.33, 1, 0.68, 1)',
          }}
        />

        {/* Główna linia - cienka, ostra, biała/gradient */}
        <path
          d="M 397 205 L 397 145 L 256 75 L 115 145 Q 115 285 115 320 Q 127 385 256 460 Q 385 385 397 320 Q 397 285 397 270 L 270 270"
          stroke="url(#shieldGradient)"
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 1.8s cubic-bezier(0.33, 1, 0.68, 1)',
            willChange: 'stroke-dashoffset',
          }}
        />
        <rect
          x={380}
          y={188}
          width={34}
          height={34}
          rx={4}
          fill="url(#shieldGradient)"
          opacity={isDrawing ? 1 : 0}
          style={{
            transition: 'opacity 1.8s cubic-bezier(0.33, 1, 0.68, 1)',
          }}
        />
      </svg>
    </div>
  );
});
