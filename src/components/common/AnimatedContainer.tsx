import { memo, useState, useEffect, useRef, ReactNode, Children, cloneElement, isValidElement } from 'react';

interface AnimatedContainerProps {
  children: ReactNode;
  isActive: boolean;
  staggerDelay?: number;
  initialDelay?: number;
  className?: string;
  initiallyHidden?: boolean;
}

interface AnimatedItemProps {
  children: ReactNode;
  animationDelay?: number;
  isAnimating?: boolean;
  isHidden?: boolean;
  className?: string;
}

// Spring animation config
const SPRING_CONFIG = {
  stiffness: 120,
  damping: 14,
};

const EXIT_DURATION = 100; // Fast fade-out (100ms)

export const AnimatedItem = memo(function AnimatedItem({
  children,
  animationDelay = 0,
  isAnimating = false,
  isHidden = false,
  className = '',
}: AnimatedItemProps) {
  // Start hidden when animating or explicitly hidden (will animate in), visible otherwise
  const [transform, setTransform] = useState(() =>
    (isAnimating || isHidden) ? { y: 20, opacity: 0 } : { y: 0, opacity: 1 }
  );
  const animationRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    // Cancel any running animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // If hidden, stay hidden
    if (isHidden) {
      setTransform({ y: 20, opacity: 0 });
      return;
    }

    // If not animating, show immediately
    if (!isAnimating) {
      setTransform({ y: 0, opacity: 1 });
      return;
    }

    // Only animate once per activation
    if (hasAnimatedRef.current) {
      setTransform({ y: 0, opacity: 1 });
      return;
    }

    // Start from offset position
    setTransform({ y: 20, opacity: 0 });

    const timeout = setTimeout(() => {
      hasAnimatedRef.current = true;
      let velocity = 0;
      let position = 20;

      const animate = () => {
        const springForce = -SPRING_CONFIG.stiffness * position;
        const dampingForce = -SPRING_CONFIG.damping * velocity;
        velocity += (springForce + dampingForce) * 0.016;
        position += velocity * 0.016;

        const opacity = Math.min(1, 1 - position / 20);
        setTransform({ y: position, opacity });

        if (Math.abs(velocity) > 0.1 || Math.abs(position) > 0.5) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setTransform({ y: 0, opacity: 1 });
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
  }, [isAnimating, isHidden, animationDelay]);

  // Reset hasAnimatedRef when animation stops
  useEffect(() => {
    if (!isAnimating) {
      hasAnimatedRef.current = false;
    }
  }, [isAnimating]);

  return (
    <div
      className={className}
      style={{
        transform: `translateY(${transform.y}px)`,
        opacity: transform.opacity,
      }}
    >
      {children}
    </div>
  );
});

export const AnimatedContainer = memo(function AnimatedContainer({
  children,
  isActive,
  staggerDelay = 100,
  initialDelay = 0,
  className = '',
  initiallyHidden = false,
}: AnimatedContainerProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isWaitingForAnimation, setIsWaitingForAnimation] = useState(false);
  const [shouldRender, setShouldRender] = useState(isActive);
  const [isExiting, setIsExiting] = useState(false);
  // If initiallyHidden=true, pretend it was previously inactive to force animation on first render
  const prevActiveRef = useRef(initiallyHidden ? false : isActive);
  const animationKeyRef = useRef(0);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any pending timers
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    if (isActive && !prevActiveRef.current) {
      // Becoming active - render immediately, animate after initialDelay
      setShouldRender(true);
      setIsExiting(false);
      animationKeyRef.current += 1;

      // Hide content during initialDelay
      if (initialDelay > 0) {
        setIsWaitingForAnimation(true);
      }

      // Start animation after initial delay
      const startTimer = setTimeout(() => {
        setIsWaitingForAnimation(false);
        setIsAnimating(true);
      }, initialDelay);

      // Stop animation after all children have animated
      const childCount = Children.count(children);
      const totalDuration = initialDelay + childCount * staggerDelay + 500;

      const stopTimer = setTimeout(() => {
        setIsAnimating(false);
      }, totalDuration);

      prevActiveRef.current = isActive;
      return () => {
        clearTimeout(startTimer);
        clearTimeout(stopTimer);
      };

    } else if (!isActive && prevActiveRef.current) {
      // Becoming inactive - fade out before unmounting
      setIsExiting(true);

      exitTimerRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
      }, EXIT_DURATION);

      prevActiveRef.current = isActive;
    }

    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, staggerDelay]);

  // Don't render when not active and fade-out is complete
  if (!shouldRender) {
    return null;
  }

  // Clone children and inject animation props
  const animatedChildren = Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child;

    const animationProps = {
      key: `${animationKeyRef.current}-${index}`,
      animationDelay: index * staggerDelay,
      isAnimating,
      isHidden: isWaitingForAnimation,
    };

    // If child is already an AnimatedItem, inject props
    if (child.type === AnimatedItem) {
      return cloneElement(child, animationProps as Partial<AnimatedItemProps>);
    }

    // Wrap non-AnimatedItem children
    return (
      <AnimatedItem {...animationProps}>
        {child}
      </AnimatedItem>
    );
  });

  return (
    <div
      className={className}
      style={{
        opacity: isExiting ? 0 : 1,
        transition: `opacity ${EXIT_DURATION}ms ease-out`,
      }}
    >
      {animatedChildren}
    </div>
  );
});
