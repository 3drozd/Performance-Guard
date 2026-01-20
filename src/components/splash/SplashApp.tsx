import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ShieldIcon } from './ShieldIcon';
import { LightningBolt } from './LightningBolt';

type Phase = 'drawing' | 'aura-fadein' | 'pulsing' | 'lightning' | 'zoom';

function FlashOverlay() {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Quick flash: 0 → 0.4 → 0
    requestAnimationFrame(() => {
      setOpacity(0.4);
      setTimeout(() => setOpacity(0), 100);
    });
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(147,197,253,0.8) 50%, rgba(59,130,246,0.7) 100%)',
        opacity,
        transition: 'opacity 100ms ease-out',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  );
}

export function SplashApp() {
  const [phase, setPhase] = useState<Phase>('drawing');
  const [showLightning, setShowLightning] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const appReadyReceived = useRef(false);
  const transitionStarted = useRef(false);

  // Show splash window when React is mounted (Tauri API ready)
  useEffect(() => {
    invoke('show_splash_window').catch(console.error);
  }, []);

  // Hide HTML ghost shield after React renders first frame
  useEffect(() => {
    // Double RAF ensures React has painted before hiding HTML ghost
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const ghostShield = document.getElementById('ghost-shield');
        if (ghostShield) {
          ghostShield.style.opacity = '0';
          // Remove from DOM after fade
          setTimeout(() => {
            ghostShield.style.display = 'none';
          }, 50);
        }
      });
    });
  }, []);

  // Listen for app-ready event from backend
  useEffect(() => {
    console.log('SplashApp: Setting up app-ready listener...');

    const unlistenPromise = listen('app-ready', () => {
      console.log('SplashApp: Received app-ready signal');
      appReadyReceived.current = true;
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, []);

  // Handle shield draw complete
  const handleDrawComplete = () => {
    console.log('SplashApp: Shield draw complete, starting aura');
    setPhase('aura-fadein');

    // After particles spawn, start pulsing
    setTimeout(() => {
      console.log('SplashApp: Aura fade-in complete, starting pulse');
      setPhase('pulsing');
    }, 400);
  };

  // Check if ready to transition (app-ready received while in pulsing phase)
  // Minimum 1.5s in pulsing phase to allow 1.5 rotations of dots
  const pulsingStartTimeRef = useRef<number | null>(null);
  const MIN_PULSING_TIME = 1500; // 1.5 seconds for 1.5 rotations

  useEffect(() => {
    if (phase !== 'pulsing') return;

    // Record when pulsing started
    if (pulsingStartTimeRef.current === null) {
      pulsingStartTimeRef.current = performance.now();
    }

    const checkReady = () => {
      const pulsingElapsed = performance.now() - (pulsingStartTimeRef.current || 0);
      const minTimePassed = pulsingElapsed >= MIN_PULSING_TIME;

      if (appReadyReceived.current && minTimePassed && !transitionStarted.current) {
        transitionStarted.current = true;
        console.log('SplashApp: App ready, starting lightning transition');

        setPhase('lightning');
        // Show lightning bolt and flash after dots fade out (150ms)
        setTimeout(() => {
          setShowFlash(true);
          setShowLightning(true);
        }, 150);
        setTimeout(() => {
          setPhase('zoom');
          setTimeout(async () => {
            try {
              await invoke('close_splash_show_main');
            } catch (error) {
              console.error('Failed to close splash:', error);
            }
          }, 250);
        }, 450); // 150ms wait + 250ms lightning + 50ms buffer
      }
    };

    // Check immediately and then every 100ms
    checkReady();
    const interval = setInterval(checkReady, 100);
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <div className="splash-container">
      {showFlash && <FlashOverlay />}
      <div
        className="splash-content"
        style={{
          transform: phase === 'zoom' ? 'scale(3)' : 'scale(1)',
          opacity: phase === 'zoom' ? 0 : 1,
          transition: phase === 'zoom' ? 'all 250ms ease-in' : 'none',
        }}
      >
        <ShieldIcon
          phase={phase}
          onDrawComplete={handleDrawComplete}
        />
        {showLightning && phase === 'lightning' && (
          <LightningBolt isActive onComplete={() => {}} />
        )}
      </div>
    </div>
  );
}
