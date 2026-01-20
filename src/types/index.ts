// Core application types

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_mb: number;
  memory_percent: number;
  gpu_percent: number;
  status: string;
  create_time: number;
  exe_path?: string;
}

export interface AppSummary {
  name: string;
  session_count: number;
  is_running: boolean;
  last_seen: string;
  exe_path?: string;
  icon?: string; // Base64 encoded PNG
  // Time tracking
  total_time_seconds: number;      // Sum of duration_seconds from all sessions
  active_time_seconds: number;     // Foreground + activity > 10%
  idle_time_seconds: number;       // Foreground + activity <= 10%
  background_time_seconds: number; // App running but not in foreground
  // Performance metrics
  avg_cpu_percent: number;         // Average CPU across all sessions
  avg_memory_percent: number;      // Average memory across all sessions
  avg_gpu_percent: number;         // Average GPU across all sessions
  avg_usage_percent: number;       // (cpu + mem + gpu) / 3
  efficiency_percent: number;      // (active / total) * 100
}

export interface Session {
  id: number;
  app_name: string;
  start_time: string;
  end_time?: string;
  duration_seconds: number;
  avg_cpu_percent: number;
  avg_memory_mb: number;
  avg_gpu_percent: number;
  peak_cpu_percent: number;
  peak_memory_mb: number;
  peak_gpu_percent: number;
  is_current: boolean;
  performance_history?: PerformanceSnapshot[]; // Performance data for this session
}

export interface PerformanceSnapshot {
  timestamp: string;
  cpu_percent: number;
  memory_mb: number;
  memory_percent: number;
  gpu_percent: number;
  user_activity_percent: number;
  is_foreground: boolean;
  keyboard_clicks: number;
  mouse_pixels: number;
}

export interface WhitelistEntry {
  id: number;
  name: string;
  exe_path?: string;
  added_date: string;
  is_tracked: boolean;
}

export interface SystemStats {
  total_memory_gb: number;
  used_memory_gb: number;
  available_memory_gb: number;
  cpu_cores: number;
  cpu_percent: number;
  memory_percent: number;
}

export interface ChartDataPoint {
  time: string;
  cpu: number;
  memory: number;
}

// View types
export type ViewType = 'dashboard' | 'whitelist' | 'details' | 'settings';

// Sort types
export type SortField = 'name' | 'total_time' | 'active_time' | 'usage' | 'efficiency' | 'sessions';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// Filter types
export interface FilterConfig {
  searchQuery: string;
  showRunningOnly: boolean;
  minCpu?: number;
  minMemory?: number;
}

// Pagination types
export interface PaginationConfig {
  page: number;
  pageSize: number;
  totalItems: number;
}

// Export types
export type ExportFormat = 'csv' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  includeHeaders: boolean;
  fileName: string;
}
