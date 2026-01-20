import { useRef, useEffect, useState, useCallback } from 'react';
import { usePlatform } from '../../contexts/PlatformContext';
import type { PerformanceSnapshot } from '../../types';

interface PerformanceChartProps {
  data: PerformanceSnapshot[];
  label: string;
  isActive?: boolean;
  animationKey?: number;
}

type TimeRange = 'all' | '5s' | '30s' | '1m';

// Bucket size: number of raw data points to aggregate into one bar
// Polling interval is ~2 seconds
const TIME_RANGE_BUCKET_SIZE: Record<TimeRange, number> = {
  'all': 1,    // No aggregation - show all raw points
  '5s': 3,     // ~6 seconds per bar (3 x 2s)
  '30s': 15,   // 30 seconds per bar (15 x 2s)
  '1m': 30,    // 1 minute per bar (30 x 2s)
};

const TIME_RANGE_LABELS: Record<TimeRange, string[]> = {
  'all': ['Start', '', '', '', 'Now'],
  '5s': ['Start', '', '', '', 'Now'],
  '30s': ['Start', '', '', '', 'Now'],
  '1m': ['Start', '', '', '', 'Now'],
};

// Aggregate data points into buckets by averaging
function aggregateData(data: PerformanceSnapshot[], bucketSize: number): PerformanceSnapshot[] {
  if (bucketSize <= 1 || data.length === 0) return data;

  const aggregated: PerformanceSnapshot[] = [];

  for (let i = 0; i < data.length; i += bucketSize) {
    const bucket = data.slice(i, Math.min(i + bucketSize, data.length));
    if (bucket.length === 0) continue;

    // Average all numeric fields
    const avgCpu = bucket.reduce((sum, p) => sum + p.cpu_percent, 0) / bucket.length;
    const avgMemMb = bucket.reduce((sum, p) => sum + p.memory_mb, 0) / bucket.length;
    const avgMemPercent = bucket.reduce((sum, p) => sum + p.memory_percent, 0) / bucket.length;
    const avgGpu = bucket.reduce((sum, p) => sum + p.gpu_percent, 0) / bucket.length;
    const avgActivity = bucket.reduce((sum, p) => sum + p.user_activity_percent, 0) / bucket.length;
    const totalKeyboardClicks = bucket.reduce((sum, p) => sum + (p.keyboard_clicks ?? 0), 0);
    const totalMousePixels = bucket.reduce((sum, p) => sum + (p.mouse_pixels ?? 0), 0);

    // Use last timestamp and foreground status of the bucket
    const lastPoint = bucket[bucket.length - 1];

    aggregated.push({
      timestamp: lastPoint.timestamp,
      cpu_percent: avgCpu,
      memory_mb: avgMemMb,
      memory_percent: avgMemPercent,
      gpu_percent: avgGpu,
      user_activity_percent: avgActivity,
      is_foreground: bucket.some(p => p.is_foreground),
      keyboard_clicks: totalKeyboardClicks,
      mouse_pixels: totalMousePixels,
    });
  }

  return aggregated;
}

// Metric configuration with colors
const METRICS = [
  { key: 'cpu_percent' as const, label: 'CPU', color: '#3b82f6' },        // Blue
  { key: 'gpu_percent' as const, label: 'GPU', color: '#a855f7' },        // Purple
  { key: 'memory_percent' as const, label: 'RAM', color: '#f59e0b' },     // Orange/Amber
  { key: 'user_activity_percent' as const, label: 'Activity', color: '#22c55e' }, // Light green
];

type MetricKey = typeof METRICS[number]['key'];

// Activity metric for expanded view
const ACTIVITY_METRIC = METRICS.find(m => m.key === 'user_activity_percent')!;

// Format memory size in MB or GB
function formatMemorySize(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

// Catmull-Rom spline interpolation - smooth curves through all points
function catmullRomInterpolation(
  values: number[],
  index: number,
  t: number,
  tension: number = 0.5
): number {
  const n = values.length;
  if (n < 2) return values[0] || 0;

  const i = Math.min(index, n - 2);

  // Get 4 points for Catmull-Rom
  const p0 = values[Math.max(0, i - 1)];
  const p1 = values[i];
  const p2 = values[i + 1];
  const p3 = values[Math.min(n - 1, i + 2)];

  // Catmull-Rom coefficients
  const t2 = t * t;
  const t3 = t2 * t;

  // Cardinal spline with tension parameter
  const s = (1 - tension) / 2;

  const c0 = -s * t3 + 2 * s * t2 - s * t;
  const c1 = (2 - s) * t3 + (s - 3) * t2 + 1;
  const c2 = (s - 2) * t3 + (3 - 2 * s) * t2 + s * t;
  const c3 = s * t3 - s * t2;

  return c0 * p0 + c1 * p1 + c2 * p2 + c3 * p3;
}

// Render a single metric chart on canvas
function renderSingleMetricChart(
  canvas: HTMLCanvasElement,
  data: PerformanceSnapshot[],
  metricKey: MetricKey,
  color: string,
  timeRange: TimeRange,
  animationProgress: number,
  options: {
    showTimeLabels?: boolean;
    showYLabels?: boolean;
    showCurrentPoint?: boolean;
    compact?: boolean;
    hoveredIndex?: number | null;
  } = {}
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { showTimeLabels = true, showYLabels = true, showCurrentPoint = true, compact = false, hoveredIndex = null } = options;

  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const padding = compact
    ? { top: 15, right: 15, bottom: showTimeLabels ? 25 : 10, left: showYLabels ? 35 : 10 }
    : { top: 20, right: 20, bottom: 30, left: 45 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Clear
  ctx.clearRect(0, 0, width, height);

  // Draw background regions for when app is in background
  data.forEach((point, i) => {
    if (!point.is_foreground && i < data.length - 1) {
      const x1 = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
      const x2 = padding.left + ((i + 1) / Math.max(data.length - 1, 1)) * chartWidth;
      ctx.fillStyle = 'rgba(39, 39, 42, 0.5)';
      ctx.fillRect(x1, padding.top, x2 - x1, chartHeight);
    }
  });

  // Draw grid lines
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1;
  const gridLines = compact ? 4 : 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartHeight / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    if (showYLabels) {
      const value = 100 - (100 * i / gridLines);
      ctx.fillStyle = '#71717a';
      ctx.font = compact ? '9px Inter, system-ui, sans-serif' : '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${value.toFixed(0)}%`, padding.left - 6, y + 4);
    }
  }

  const getY = (value: number) => {
    const normalized = Math.min(100, Math.max(0, value)) / 100;
    const animatedNormalized = normalized * animationProgress;
    return height - padding.bottom - animatedNormalized * chartHeight;
  };

  const getX = (index: number) => {
    if (data.length <= 1) return padding.left;
    return padding.left + (index / (data.length - 1)) * chartWidth;
  };

  const values = data.map(d => d[metricKey] ?? 0);
  if (values.length >= 2) {
    // Build path
    const linePath: { x: number; y: number }[] = [];
    linePath.push({ x: getX(0), y: getY(values[0]) });

    for (let i = 0; i < values.length - 1; i++) {
      const x1 = getX(i);
      const x2 = getX(i + 1);
      const steps = compact ? 8 : 12;
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const x = x1 + (x2 - x1) * t;
        const y = catmullRomInterpolation(values, i, t, 0.3);
        linePath.push({ x, y: getY(y) });
      }
    }

    const minLineY = Math.min(...linePath.map(p => p.y));
    const bottomY = height - padding.bottom;

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, minLineY, 0, bottomY);
    gradient.addColorStop(0, `${color}40`);
    gradient.addColorStop(0.5, `${color}15`);
    gradient.addColorStop(1, `${color}00`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(linePath[0].x, linePath[0].y);
    for (let i = 1; i < linePath.length; i++) {
      ctx.lineTo(linePath[i].x, linePath[i].y);
    }
    ctx.lineTo(linePath[linePath.length - 1].x, bottomY);
    ctx.lineTo(linePath[0].x, bottomY);
    ctx.closePath();
    ctx.fill();

    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = compact ? 1.5 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(linePath[0].x, linePath[0].y);
    for (let i = 1; i < linePath.length; i++) {
      ctx.lineTo(linePath[i].x, linePath[i].y);
    }
    ctx.stroke();

    // Current point glow
    if (showCurrentPoint) {
      const lastX = getX(values.length - 1);
      const lastY = getY(values[values.length - 1]);

      ctx.fillStyle = `${color}30`;
      ctx.beginPath();
      ctx.arc(lastX, lastY, compact ? 6 : 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `${color}60`;
      ctx.beginPath();
      ctx.arc(lastX, lastY, compact ? 4 : 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lastX, lastY, compact ? 2 : 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw hover indicator (dashed line + point)
    if (hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < data.length) {
      const hoverX = getX(hoveredIndex);
      const value = data[hoveredIndex]?.[metricKey] ?? 0;
      const hoverY = getY(value);

      // Dashed vertical line
      ctx.strokeStyle = '#71717a';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverX, padding.top);
      ctx.lineTo(hoverX, height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point on the line with white border
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(hoverX, hoverY, compact ? 4 : 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hoverX, hoverY, compact ? 4 : 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // No data message
  if (data.length === 0) {
    ctx.fillStyle = '#71717a';
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting data...', width / 2, height / 2);
  }

  // X-axis labels
  if (showTimeLabels) {
    ctx.fillStyle = '#71717a';
    ctx.font = compact ? '8px Inter, system-ui, sans-serif' : '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';

    const timeLabels = TIME_RANGE_LABELS[timeRange];
    timeLabels.forEach((labelText, index) => {
      const x = padding.left + (index / (timeLabels.length - 1)) * chartWidth;
      ctx.fillText(labelText, x, height - (compact ? 6 : 10));
    });
  }
}

export function PerformanceChart({
  data,
  label,
  isActive = true,
  animationKey,
}: PerformanceChartProps) {
  const platform = usePlatform();
  const showGpu = platform === 'windows' || platform === 'unknown';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [visibleMetrics, setVisibleMetrics] = useState<Set<MetricKey>>(
    new Set(METRICS.map(m => m.key))
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Hover state for expanded mini-charts
  const [expandedHover, setExpandedHover] = useState<{
    chart: 'activity' | 'cpu' | 'gpu' | 'ram';
    index: number;
    pos: { x: number; y: number };
  } | null>(null);

  // Expansion state - CSS animated
  const [isExpanded, setIsExpanded] = useState(false);

  // Refs for expanded view canvases
  const activityCanvasRef = useRef<HTMLCanvasElement>(null);
  const cpuCanvasRef = useRef<HTMLCanvasElement>(null);
  const gpuCanvasRef = useRef<HTMLCanvasElement>(null);
  const ramCanvasRef = useRef<HTMLCanvasElement>(null);
  const expandedContainerRef = useRef<HTMLDivElement>(null);

  // Dimensions for expanded view (triggers re-render on resize)
  const [expandedDimensions, setExpandedDimensions] = useState({ width: 0, height: 0 });

  // Ref for Activity label to calculate slide offset
  const activityLabelRef = useRef<HTMLDivElement>(null);
  const legendRowRef = useRef<HTMLDivElement>(null);
  const [activityOffset, setActivityOffset] = useState(0);

  // Animation state for chart growth - start at 1 (fully drawn) to prevent flat chart on tab return
  const [animationProgress, setAnimationProgress] = useState(1);
  const animationProgressRef = useRef(1);
  const animationKeyRef = useRef<number | undefined>(undefined);
  const animationFrameRef = useRef<number | null>(null);
  const hasAnimatedOnceRef = useRef(false);

  // Handle chart click for expand/collapse
  const handleChartClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    // Hide all tooltips when clicking (collapsed and expanded views)
    setHoveredIndex(null);
    setTooltipPos(null);
    setExpandedHover(null);

    // Calculate offset BEFORE expanding (when still collapsed)
    if (!isExpanded && activityLabelRef.current && legendRowRef.current) {
      const rowRect = legendRowRef.current.getBoundingClientRect();
      const activityRect = activityLabelRef.current.getBoundingClientRect();
      const offset = activityRect.left - rowRect.left;
      if (offset > 0) {
        setActivityOffset(offset);
      }
    }

    setIsExpanded(prev => !prev);
  }, [isExpanded]);

  // Calculate Activity label offset on mount and when collapsed
  useEffect(() => {
    const calculateOffset = () => {
      if (activityLabelRef.current && legendRowRef.current && !isExpanded) {
        const rowRect = legendRowRef.current.getBoundingClientRect();
        const activityRect = activityLabelRef.current.getBoundingClientRect();
        const offset = activityRect.left - rowRect.left;
        if (offset > 0) {
          setActivityOffset(offset);
        }
      }
    };

    // Calculate immediately
    calculateOffset();

    // Also calculate after a small delay for initial render
    const timeout = setTimeout(calculateOffset, 50);
    return () => clearTimeout(timeout);
  }, [isExpanded, dimensions.width]);

  // Spring animation when animationKey changes
  // First appearance: animate from 0 (grow from bottom)
  // Session changes: animate from current value to 1
  useEffect(() => {
    if (animationKey === undefined) return;

    // Check if this is the very first animation ever
    const isFirstAnimation = !hasAnimatedOnceRef.current;

    // Skip if same key (already animated this session)
    if (animationKey === animationKeyRef.current) return;

    animationKeyRef.current = animationKey;
    hasAnimatedOnceRef.current = true;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const stiffness = 100;
    const damping = 12;
    let velocity = 0;
    // First animation: start from 0 (grow effect)
    // Subsequent: start from current position
    let position = isFirstAnimation ? 0 : animationProgressRef.current;
    const target = 1;

    // Only animate if not already at target
    if (Math.abs(target - position) < 0.01) {
      return;
    }

    const animate = () => {
      const displacement = position - target;
      const springForce = -stiffness * displacement;
      const dampingForce = -damping * velocity;
      velocity += (springForce + dampingForce) * 0.016;
      position += velocity * 0.016;

      // Update both ref and state
      animationProgressRef.current = Math.min(1, Math.max(0, position));
      setAnimationProgress(animationProgressRef.current);

      if (Math.abs(velocity) > 0.001 || Math.abs(target - position) > 0.001) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationProgressRef.current = 1;
        setAnimationProgress(1);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animationKey]); // Only depend on animationKey, not animationProgress

  // Observe container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(container);

    if (isActive) {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height });
      }
    }

    return () => resizeObserver.disconnect();
  }, [isActive]);

  // Observe expanded container size for resize handling
  useEffect(() => {
    const container = expandedContainerRef.current;
    if (!container || !isExpanded) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setExpandedDimensions({ width, height });
      }
    });

    resizeObserver.observe(container);

    // Initial measurement
    const rect = container.getBoundingClientRect();
    if (rect.width > 0) {
      setExpandedDimensions({ width: rect.width, height: rect.height });
    }

    return () => resizeObserver.disconnect();
  }, [isExpanded]);

  // Aggregate data based on time range bucket size
  const bucketSize = TIME_RANGE_BUCKET_SIZE[timeRange];
  const filteredData = aggregateData(data, bucketSize);

  // Calculate stats for visible metrics
  const stats = METRICS.reduce((acc, metric) => {
    const values = filteredData.map(d => d[metric.key] ?? 0);
    acc[metric.key] = {
      current: values.length > 0 ? values[values.length - 1] : 0,
      avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
    };
    return acc;
  }, {} as Record<MetricKey, { current: number; avg: number; max: number }>);

  // Chart padding
  const padding = { top: 20, right: 20, bottom: 30, left: 45 };

  // Handle mouse move on canvas
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || filteredData.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const chartWidth = dimensions.width - padding.left - padding.right;

    if (x < padding.left || x > dimensions.width - padding.right) {
      setHoveredIndex(null);
      setTooltipPos(null);
      return;
    }

    const relativeX = x - padding.left;
    const ratio = relativeX / chartWidth;
    const index = Math.round(ratio * (filteredData.length - 1));
    const clampedIndex = Math.max(0, Math.min(filteredData.length - 1, index));

    setHoveredIndex(clampedIndex);
    setTooltipPos({ x: e.clientX - rect.left, y });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, filteredData.length]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
    setTooltipPos(null);
  }, []);

  // Handle mouse move on mini-charts in expanded view
  const handleMiniChartMouseMove = useCallback((
    e: React.MouseEvent<HTMLCanvasElement>,
    chart: 'activity' | 'cpu' | 'gpu' | 'ram',
    canvasEl: HTMLCanvasElement | null
  ) => {
    if (!canvasEl || filteredData.length === 0) return;

    const rect = canvasEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const chartWidth = rect.width;

    // Simple padding estimate for mini-charts
    const padding = 5;
    if (x < padding || x > chartWidth - padding) {
      setExpandedHover(null);
      return;
    }

    const relativeX = x - padding;
    const ratio = relativeX / (chartWidth - padding * 2);
    const index = Math.round(ratio * (filteredData.length - 1));
    const clampedIndex = Math.max(0, Math.min(filteredData.length - 1, index));

    setExpandedHover({ chart, index: clampedIndex, pos: { x, y } });
  }, [filteredData.length]);

  const handleMiniChartMouseLeave = useCallback(() => {
    setExpandedHover(null);
  }, []);

  // Draw collapsed chart - always render (visibility controlled by CSS)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const chartWidth = dimensions.width - padding.left - padding.right;
    const chartHeight = dimensions.height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw background regions
    filteredData.forEach((point, i) => {
      if (!point.is_foreground && i < filteredData.length - 1) {
        const x1 = padding.left + (i / Math.max(filteredData.length - 1, 1)) * chartWidth;
        const x2 = padding.left + ((i + 1) / Math.max(filteredData.length - 1, 1)) * chartWidth;
        ctx.fillStyle = 'rgba(39, 39, 42, 0.5)';
        ctx.fillRect(x1, padding.top, x2 - x1, chartHeight);
      }
    });

    // Draw grid lines
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(dimensions.width - padding.right, y);
      ctx.stroke();

      const value = 100 - (100 * i / gridLines);
      ctx.fillStyle = '#71717a';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${value.toFixed(0)}%`, padding.left - 8, y + 4);
    }

    const getY = (value: number) => {
      const normalized = Math.min(100, Math.max(0, value)) / 100;
      const animatedNormalized = normalized * animationProgress;
      return dimensions.height - padding.bottom - animatedNormalized * chartHeight;
    };

    const getX = (index: number) => {
      if (filteredData.length <= 1) return padding.left;
      return padding.left + (index / (filteredData.length - 1)) * chartWidth;
    };

    // Draw each metric line
    METRICS.forEach(metric => {
      if (!visibleMetrics.has(metric.key)) return;

      const values = filteredData.map(d => d[metric.key] ?? 0);
      if (values.length < 2) return;

      const color = metric.color;

      const linePath: { x: number; y: number }[] = [];
      linePath.push({ x: getX(0), y: getY(values[0]) });

      for (let i = 0; i < values.length - 1; i++) {
        const x1 = getX(i);
        const x2 = getX(i + 1);
        const steps = 12;
        for (let step = 1; step <= steps; step++) {
          const t = step / steps;
          const x = x1 + (x2 - x1) * t;
          const y = catmullRomInterpolation(values, i, t, 0.3);
          linePath.push({ x, y: getY(y) });
        }
      }

      const minLineY = Math.min(...linePath.map(p => p.y));
      const bottomY = dimensions.height - padding.bottom;

      const gradient = ctx.createLinearGradient(0, minLineY, 0, bottomY);
      gradient.addColorStop(0, `${color}40`);
      gradient.addColorStop(0.5, `${color}15`);
      gradient.addColorStop(1, `${color}00`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(linePath[0].x, linePath[0].y);
      for (let i = 1; i < linePath.length; i++) {
        ctx.lineTo(linePath[i].x, linePath[i].y);
      }
      ctx.lineTo(linePath[linePath.length - 1].x, bottomY);
      ctx.lineTo(linePath[0].x, bottomY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(linePath[0].x, linePath[0].y);
      for (let i = 1; i < linePath.length; i++) {
        ctx.lineTo(linePath[i].x, linePath[i].y);
      }
      ctx.stroke();

      const lastX = getX(values.length - 1);
      const lastY = getY(values[values.length - 1]);

      ctx.fillStyle = `${color}30`;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `${color}60`;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    if (filteredData.length === 0) {
      ctx.fillStyle = '#71717a';
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Collecting data...', dimensions.width / 2, dimensions.height / 2);
    }

    ctx.fillStyle = '#71717a';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';

    const timeLabels = TIME_RANGE_LABELS[timeRange];
    timeLabels.forEach((labelText, index) => {
      const x = padding.left + (index / (timeLabels.length - 1)) * chartWidth;
      ctx.fillText(labelText, x, dimensions.height - 10);
    });

    // Draw crosshair and hover points
    if (hoveredIndex !== null && filteredData.length > 0) {
      const hoverX = getX(hoveredIndex);

      ctx.strokeStyle = '#52525b';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverX, padding.top);
      ctx.lineTo(hoverX, dimensions.height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      METRICS.forEach(metric => {
        if (!visibleMetrics.has(metric.key)) return;
        const value = filteredData[hoveredIndex]?.[metric.key] ?? 0;
        const pointY = getY(value);

        ctx.fillStyle = metric.color;
        ctx.beginPath();
        ctx.arc(hoverX, pointY, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hoverX, pointY, 5, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, filteredData, timeRange, visibleMetrics, hoveredIndex, animationProgress]);

  // Draw expanded view charts - only when expanded
  useEffect(() => {
    if (!isExpanded) return;

    // Activity chart
    if (activityCanvasRef.current) {
      renderSingleMetricChart(
        activityCanvasRef.current,
        filteredData,
        'user_activity_percent',
        ACTIVITY_METRIC.color,
        timeRange,
        animationProgress,
        { showTimeLabels: true, showYLabels: true, compact: false,
          hoveredIndex: expandedHover?.chart === 'activity' ? expandedHover.index : null }
      );
    }

    // CPU chart
    if (cpuCanvasRef.current) {
      renderSingleMetricChart(
        cpuCanvasRef.current,
        filteredData,
        'cpu_percent',
        METRICS[0].color,
        timeRange,
        animationProgress,
        { showTimeLabels: false, showYLabels: true, compact: true,
          hoveredIndex: expandedHover?.chart === 'cpu' ? expandedHover.index : null }
      );
    }

    // GPU chart - Windows only
    if (showGpu && gpuCanvasRef.current) {
      renderSingleMetricChart(
        gpuCanvasRef.current,
        filteredData,
        'gpu_percent',
        METRICS[1].color,
        timeRange,
        animationProgress,
        { showTimeLabels: false, showYLabels: false, compact: true,
          hoveredIndex: expandedHover?.chart === 'gpu' ? expandedHover.index : null }
      );
    }

    // RAM chart
    if (ramCanvasRef.current) {
      renderSingleMetricChart(
        ramCanvasRef.current,
        filteredData,
        'memory_percent',
        METRICS[2].color,
        timeRange,
        animationProgress,
        { showTimeLabels: true, showYLabels: true, compact: true,
          hoveredIndex: expandedHover?.chart === 'ram' ? expandedHover.index : null }
      );
    }
  }, [filteredData, timeRange, animationProgress, isExpanded, expandedDimensions, expandedHover, showGpu]);

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
  }, []);

  const toggleMetric = useCallback((key: MetricKey) => {
    setVisibleMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) {
          next.delete(key);
        }
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Fixed heights
  const collapsedHeight = 192;
  const miniChartHeight = 100;

  return (
    <div className="glass-card p-4 cursor-pointer select-none min-w-[500px]" onClick={handleChartClick}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary">{label}</h3>

        {/* Time range buttons */}
        <div className="flex items-center gap-1">
          {(['all', '5s', '30s', '1m'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={(e) => {
                e.stopPropagation();
                handleTimeRangeChange(range);
              }}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                timeRange === range
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-elevated text-text-muted hover:text-text-primary hover:bg-bg-card-hover'
              }`}
            >
              {range === 'all' ? 'All' : range}
            </button>
          ))}
        </div>
      </div>

      {/* Legend - all metrics in one row, Activity slides left on expand */}
      <div ref={legendRowRef} className="flex items-center gap-4 text-xs mb-2 relative">
        {/* CPU, GPU (Windows only), RAM - fade out on expand */}
        {METRICS.filter(m => m.key !== 'user_activity_percent' && (showGpu || m.key !== 'gpu_percent')).map(metric => (
          <button
            key={metric.key}
            onClick={(e) => {
              e.stopPropagation();
              toggleMetric(metric.key);
            }}
            className={`flex items-center gap-1.5 chart-view-transition ${
              visibleMetrics.has(metric.key) ? 'opacity-100' : 'opacity-40'
            }`}
            style={{
              opacity: isExpanded ? 0 : (visibleMetrics.has(metric.key) ? 1 : 0.4),
              pointerEvents: isExpanded ? 'none' : 'auto'
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: metric.color }}
            />
            <span className="text-text-muted">{metric.label}:</span>
            <span style={{ color: metric.color }}>
              {stats[metric.key]?.current.toFixed(1)}%
            </span>
          </button>
        ))}

        {/* Activity - slides from right to left on expand */}
        <div
          ref={activityLabelRef}
          className="flex items-center gap-1.5 activity-label-transition"
          style={{
            transform: isExpanded ? `translateX(-${activityOffset}px)` : 'translateX(0)'
          }}
        >
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: ACTIVITY_METRIC.color }}
          />
          <span className="text-text-muted">{ACTIVITY_METRIC.label}:</span>
          <span style={{ color: ACTIVITY_METRIC.color }}>
            {stats['user_activity_percent']?.current.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Chart area container */}
      <div className="relative w-full">
        {/* Collapsed view - always in DOM, controlled by CSS */}
        <div
          ref={containerRef}
          className="chart-view-transition"
          style={{
            height: collapsedHeight,
            opacity: isExpanded ? 0 : 1,
            pointerEvents: isExpanded ? 'none' : 'auto',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
          {/* Tooltip */}
          {!isExpanded && hoveredIndex !== null && tooltipPos && filteredData[hoveredIndex] && (
            <div
              className="absolute pointer-events-none z-50 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg px-3 py-2 text-xs"
              style={{
                left: tooltipPos.x > dimensions.width / 2 ? tooltipPos.x - 140 : tooltipPos.x + 12,
                top: Math.max(8, Math.min(tooltipPos.y - 40, dimensions.height - 120)),
              }}
            >
              <div className="text-text-muted mb-1.5 pb-1.5 border-b border-border-subtle">
                {new Date(filteredData[hoveredIndex].timestamp).toLocaleTimeString()}
              </div>
              {METRICS.map(metric => {
                if (!visibleMetrics.has(metric.key)) return null;
                const point = filteredData[hoveredIndex];

                // Format value based on metric type
                let displayValue: string;
                if (metric.key === 'memory_percent') {
                  // RAM: show in MB/GB
                  displayValue = formatMemorySize(point.memory_mb ?? 0);
                } else if (metric.key === 'user_activity_percent') {
                  // Activity: show % + keyboard/mouse details
                  const keys = point.keyboard_clicks ?? 0;
                  const pixels = point.mouse_pixels ?? 0;
                  displayValue = `${(point.user_activity_percent ?? 0).toFixed(0)}% (${keys} keys, ${pixels}px)`;
                } else {
                  // CPU/GPU: show percentage
                  displayValue = `${(point[metric.key] ?? 0).toFixed(1)}%`;
                }

                return (
                  <div key={metric.key} className="flex items-center justify-between gap-4 py-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: metric.color }}
                      />
                      <span className="text-text-muted">{metric.label}</span>
                    </div>
                    <span className="font-medium" style={{ color: metric.color }}>
                      {displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Expanded Activity chart - overlays collapsed view, not affected by grid animation */}
        <div
          ref={expandedContainerRef}
          className="relative w-full chart-view-transition"
          style={{
            height: collapsedHeight,
            marginTop: -collapsedHeight,
            opacity: isExpanded ? 1 : 0,
            pointerEvents: isExpanded ? 'auto' : 'none',
          }}
        >
          <canvas
            ref={activityCanvasRef}
            style={{ width: '100%', height: '100%' }}
            onMouseMove={(e) => handleMiniChartMouseMove(e, 'activity', activityCanvasRef.current)}
            onMouseLeave={handleMiniChartMouseLeave}
            onClick={(e) => { e.stopPropagation(); handleChartClick(e); }}
          />
          {/* Activity tooltip */}
          {expandedHover?.chart === 'activity' && filteredData[expandedHover.index] && (
            <div
              className="absolute pointer-events-none z-10 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg px-2 py-1 text-xs"
              style={{
                left: expandedHover.pos.x > 100 ? expandedHover.pos.x - 80 : expandedHover.pos.x + 12,
                top: Math.max(4, expandedHover.pos.y - 30),
              }}
            >
              <div className="text-text-muted text-[10px] mb-0.5">
                {new Date(filteredData[expandedHover.index].timestamp).toLocaleTimeString()}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ACTIVITY_METRIC.color }} />
                <span style={{ color: ACTIVITY_METRIC.color }}>
                  {filteredData[expandedHover.index].user_activity_percent.toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Expanded view - CSS grid animation for 2x2 grid only */}
        <div
          className={`chart-expand-container ${isExpanded ? 'expanded' : 'collapsed'}`}
          style={{
            pointerEvents: isExpanded ? 'auto' : 'none'
          }}
        >
          <div className="chart-expand-content">
            {/* 2x2 Grid for CPU, GPU, RAM - all same height, with fade */}
            <div
              className="grid grid-cols-2 gap-3 chart-view-transition"
              style={{ opacity: isExpanded ? 1 : 0, overflow: 'clip' }}
            >
              {/* CPU */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: METRICS[0].color }}
                  />
                  <span className="text-xs text-text-muted">{METRICS[0].label}:</span>
                  <span className="text-xs" style={{ color: METRICS[0].color }}>
                    {stats['cpu_percent']?.current.toFixed(1)}%
                  </span>
                </div>
                <div className="relative" style={{ height: miniChartHeight }}>
                  <canvas
                    ref={cpuCanvasRef}
                    style={{ width: '100%', height: '100%' }}
                    onMouseMove={(e) => handleMiniChartMouseMove(e, 'cpu', cpuCanvasRef.current)}
                    onMouseLeave={handleMiniChartMouseLeave}
                    onClick={(e) => { e.stopPropagation(); handleChartClick(e); }}
                  />
                  {expandedHover?.chart === 'cpu' && filteredData[expandedHover.index] && (
                    <div
                      className="absolute pointer-events-none z-10 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg px-2 py-1 text-xs"
                      style={{
                        left: expandedHover.pos.x > 80 ? expandedHover.pos.x - 70 : expandedHover.pos.x + 8,
                        top: Math.max(4, expandedHover.pos.y - 30),
                      }}
                    >
                      <div className="text-text-muted text-[10px] mb-0.5">
                        {new Date(filteredData[expandedHover.index].timestamp).toLocaleTimeString()}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: METRICS[0].color }} />
                        <span style={{ color: METRICS[0].color }}>
                          {filteredData[expandedHover.index].cpu_percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* GPU - Windows only */}
              {showGpu && (
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: METRICS[1].color }}
                    />
                    <span className="text-xs text-text-muted">{METRICS[1].label}:</span>
                    <span className="text-xs" style={{ color: METRICS[1].color }}>
                      {stats['gpu_percent']?.current.toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative" style={{ height: miniChartHeight }}>
                    <canvas
                      ref={gpuCanvasRef}
                      style={{ width: '100%', height: '100%' }}
                      onMouseMove={(e) => handleMiniChartMouseMove(e, 'gpu', gpuCanvasRef.current)}
                      onMouseLeave={handleMiniChartMouseLeave}
                      onClick={(e) => { e.stopPropagation(); handleChartClick(e); }}
                    />
                    {expandedHover?.chart === 'gpu' && filteredData[expandedHover.index] && (
                      <div
                        className="absolute pointer-events-none z-10 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg px-2 py-1 text-xs"
                        style={{
                          left: expandedHover.pos.x > 80 ? expandedHover.pos.x - 70 : expandedHover.pos.x + 8,
                          top: Math.max(4, expandedHover.pos.y - 30),
                        }}
                      >
                        <div className="text-text-muted text-[10px] mb-0.5">
                          {new Date(filteredData[expandedHover.index].timestamp).toLocaleTimeString()}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: METRICS[1].color }} />
                          <span style={{ color: METRICS[1].color }}>
                            {filteredData[expandedHover.index].gpu_percent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RAM */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: METRICS[2].color }}
                  />
                  <span className="text-xs text-text-muted">{METRICS[2].label}:</span>
                  <span className="text-xs" style={{ color: METRICS[2].color }}>
                    {stats['memory_percent']?.current.toFixed(1)}%
                  </span>
                </div>
                <div className="relative" style={{ height: miniChartHeight }}>
                  <canvas
                    ref={ramCanvasRef}
                    style={{ width: '100%', height: '100%' }}
                    onMouseMove={(e) => handleMiniChartMouseMove(e, 'ram', ramCanvasRef.current)}
                    onMouseLeave={handleMiniChartMouseLeave}
                    onClick={(e) => { e.stopPropagation(); handleChartClick(e); }}
                  />
                  {expandedHover?.chart === 'ram' && filteredData[expandedHover.index] && (
                    <div
                      className="absolute pointer-events-none z-10 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg px-2 py-1 text-xs"
                      style={{
                        left: expandedHover.pos.x > 80 ? expandedHover.pos.x - 70 : expandedHover.pos.x + 8,
                        top: Math.max(4, expandedHover.pos.y - 30),
                      }}
                    >
                      <div className="text-text-muted text-[10px] mb-0.5">
                        {new Date(filteredData[expandedHover.index].timestamp).toLocaleTimeString()}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: METRICS[2].color }} />
                        <span style={{ color: METRICS[2].color }}>
                          {filteredData[expandedHover.index].memory_percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats summary - same structure as charts */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-text-muted">Stats:</span>
                </div>
                <div
                  className="flex flex-col justify-center items-center text-xs text-text-muted"
                  style={{ height: miniChartHeight }}
                >
                  <div className="text-center">
                    <div className="mb-2">{filteredData.length} data points</div>
                    <div className="text-text-primary/60">
                      Time range: {timeRange === 'all' ? 'All' : timeRange}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-xs text-text-muted text-center mt-2 opacity-60">
        Click on chart to {isExpanded ? 'collapse' : 'expand'}
      </p>
    </div>
  );
}
