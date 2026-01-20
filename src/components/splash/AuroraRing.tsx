import { useRef, useEffect, memo, useMemo } from 'react';

interface AuroraRingProps {
  size: number;
  isActive: boolean;
  phase?: string;
}

const PARTICLE_COUNT = 12;

// Generuj kropki - pojawiają się coraz szybciej (ease-out)
const createParticles = () => {
  // Pseudo-losowa kolejność przez modulo
  const spawnOrder = Array.from({ length: PARTICLE_COUNT }, (_, i) => (i * 7) % PARTICLE_COUNT);

  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const orderIndex = spawnOrder.indexOf(i);
    // Ease-out: pierwsze wolno, kolejne coraz szybciej
    // t = 1 - (1 - x)² gdzie x = orderIndex / (count - 1)
    const x = orderIndex / (PARTICLE_COUNT - 1);
    const easeOut = 1 - Math.pow(1 - x, 2);

    return {
      // Pozycja - równomierne rozłożenie
      angle: (i / PARTICLE_COUNT) * Math.PI * 2,
      // Czas pojawienia - ease-out spawn over 300ms, first dot immediately
      spawnTime: easeOut * 0.3,
    };
  });
};

export const AuroraRing = memo(function AuroraRing({ size, isActive, phase }: AuroraRingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useMemo(() => createParticles(), []);
  const lightningStartTimeRef = useRef<number | null>(null);
  const phaseRef = useRef(phase);

  // Aktualizuj ref gdy phase się zmienia
  useEffect(() => {
    phaseRef.current = phase;
    if (phase === 'lightning') {
      lightningStartTimeRef.current = performance.now();
    }
  }, [phase]);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let frame: number;
    const startTime = performance.now();

    // Parametry przyspieszenia rotacji
    const initialSpeed = 0.5;   // Początkowa prędkość (rad/s)
    const acceleration = 8.0;   // Przyspieszenie (rad/s²) - bardzo szybki wzrost na końcu

    // Kąt segmentu - gdy cień = segmentAngle, okrąg jest zamknięty
    const segmentAngle = (Math.PI * 2) / PARTICLE_COUNT;

    // Czas po którym ślad ma być pełny (zamknięty okrąg)
    const fullTrailTime = 3.0; // sekundy

    const draw = (time: number) => {
      const elapsed = (time - startTime) / 1000;

      ctx.clearRect(0, 0, size, size);

      const centerX = size / 2;
      const centerY = size / 2;
      const orbitRadius = size * 0.35;
      const lineWidth = 3;

      // Rotacja z przyspieszeniem: θ = v0*t + 0.5*a*t²
      const rotationAngle = initialSpeed * elapsed + 0.5 * acceleration * elapsed * elapsed;

      // Długość cienia - niezależna od prędkości, zależna od czasu
      // Po fullTrailTime ślad = pełny segment + overlap
      const trailProgress = Math.min(elapsed / fullTrailTime, 1);
      // Ease-in: wolno na początku, szybko na końcu
      const trailEased = trailProgress * trailProgress;
      // Dodaj 200% overlap żeby ślady były jeszcze dłuższe
      const trailLength = trailEased * (segmentAngle * 3.0);

      // Efekt błysku podczas fazy lightning (zsynchronizowany z FlashOverlay)
      // Po błysku kropki zostają niewidoczne (także w fazie zoom)
      let flashMultiplier = 1;
      if (phaseRef.current === 'zoom') {
        // W fazie zoom kropki są niewidoczne
        flashMultiplier = 0;
      } else if (phaseRef.current === 'lightning' && lightningStartTimeRef.current) {
        const flashElapsed = (time - lightningStartTimeRef.current) / 1000;
        if (flashElapsed < 0.05) {
          // 0-50ms: rozjaśnienie (1 → 2)
          flashMultiplier = 1 + (flashElapsed / 0.05);
        } else if (flashElapsed < 0.15) {
          // 50-150ms: zanikanie (2 → 0)
          flashMultiplier = 2 * (1 - (flashElapsed - 0.05) / 0.1);
        } else {
          // Po 150ms: niewidoczne
          flashMultiplier = 0;
        }
      }

      // Rysuj tylko kropki które już się pojawiły (na podstawie czasu)
      particles.forEach((particle) => {
        if (elapsed < particle.spawnTime) return;

        const angle = particle.angle + rotationAngle;

        // Rysuj cień/ślad jako łuk (granatowy z poświatą)
        if (trailLength > 0.01 && flashMultiplier > 0) {
          // Poświata cienia (granatowy) - szerszy glow
          ctx.strokeStyle = `rgba(30, 41, 99, ${0.6 * flashMultiplier})`;
          ctx.lineWidth = lineWidth * 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(centerX, centerY, orbitRadius, angle - trailLength, angle);
          ctx.stroke();

          // Główny cień (ciemnoniebieski/granatowy)
          ctx.strokeStyle = `rgba(55, 65, 145, ${Math.min(0.9 * flashMultiplier, 1)})`;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.arc(centerX, centerY, orbitRadius, angle - trailLength, angle);
          ctx.stroke();
        }

        // Główna kropka (na końcu cienia) - biały środek z jasnoniebieskm glow
        if (flashMultiplier > 0) {
          const x = centerX + Math.cos(angle) * orbitRadius;
          const y = centerY + Math.sin(angle) * orbitRadius;

          // Zewnętrzny glow - jasnoniebieski
          ctx.fillStyle = `rgba(147, 197, 253, ${0.5 * flashMultiplier})`;
          ctx.beginPath();
          ctx.arc(x, y, lineWidth * 1.5, 0, Math.PI * 2);
          ctx.fill();

          // Wewnętrzny środek - prawie biały (jak gradient tarczy)
          ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * Math.min(flashMultiplier, 1)})`;
          ctx.beginPath();
          ctx.arc(x, y, lineWidth * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      frame = requestAnimationFrame(draw);
    };

    draw(performance.now()); // Natychmiastowe pierwsze rysowanie
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [size, isActive, particles]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        pointerEvents: 'none',
      }}
    />
  );
});
