import { invoke } from '@tauri-apps/api/core';
import type { ProcessInfo, SystemStats, WhitelistEntry, Session } from '../types';

// Backend returns slightly different types, map them to our frontend types
interface BackendProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_mb: number;
  memory_percent: number;
  gpu_percent: number;
  status: string;
  create_time: number;
  exe_path: string | null;
}

interface BackendSystemStats {
  cpu_percent: number;
  memory_percent: number;
  total_memory_gb: number;
  used_memory_gb: number;
  available_memory_gb: number;
  cpu_cores: number;
}

export async function getProcesses(): Promise<ProcessInfo[]> {
  const processes = await invoke<BackendProcessInfo[]>('get_processes');
  return processes.map(p => ({
    pid: p.pid,
    name: p.name,
    cpu_percent: p.cpu_percent,
    memory_mb: p.memory_mb,
    memory_percent: p.memory_percent,
    gpu_percent: p.gpu_percent,
    status: p.status,
    create_time: p.create_time,
    exe_path: p.exe_path ?? undefined,
  }));
}

export async function getSystemStats(): Promise<SystemStats> {
  const stats = await invoke<BackendSystemStats>('get_system_stats');
  return {
    cpu_percent: stats.cpu_percent,
    memory_percent: stats.memory_percent,
    total_memory_gb: stats.total_memory_gb,
    used_memory_gb: stats.used_memory_gb,
    available_memory_gb: stats.available_memory_gb,
    cpu_cores: stats.cpu_cores,
  };
}

export async function getProcessByPid(pid: number): Promise<ProcessInfo | null> {
  const process = await invoke<BackendProcessInfo | null>('get_process_by_pid', { pid });
  if (!process) return null;
  return {
    pid: process.pid,
    name: process.name,
    cpu_percent: process.cpu_percent,
    memory_mb: process.memory_mb,
    memory_percent: process.memory_percent,
    gpu_percent: process.gpu_percent,
    status: process.status,
    create_time: process.create_time,
    exe_path: process.exe_path ?? undefined,
  };
}

// Data persistence types
interface SavedWhitelistEntry {
  id: number;
  name: string;
  exe_path: string | null;
  added_date: string;
  is_tracked: boolean;
}

interface SavedPerformanceSnapshot {
  timestamp: string;
  cpu_percent: number;
  memory_mb: number;
  memory_percent: number;
  gpu_percent: number;
  user_activity_percent: number;
  is_foreground: boolean;
  keyboard_clicks?: number;
  mouse_pixels?: number;
}

interface SavedSession {
  id: number;
  app_name: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  avg_cpu_percent: number;
  avg_memory_mb: number;
  avg_gpu_percent: number;
  peak_cpu_percent: number;
  peak_memory_mb: number;
  peak_gpu_percent: number;
  is_current: boolean;
  performance_history: SavedPerformanceSnapshot[];
}

interface AppData {
  whitelist: SavedWhitelistEntry[];
  sessions: SavedSession[];
  next_session_id: number;
}

export async function saveAppData(
  whitelist: WhitelistEntry[],
  sessions: Session[],
  nextSessionId: number
): Promise<void> {
  const savedWhitelist: SavedWhitelistEntry[] = whitelist.map(w => ({
    id: w.id,
    name: w.name,
    exe_path: w.exe_path ?? null,
    added_date: w.added_date,
    is_tracked: w.is_tracked,
  }));

  const savedSessions: SavedSession[] = sessions
    .filter(s => !s.is_current) // Only save completed sessions
    .map(s => ({
      id: s.id,
      app_name: s.app_name,
      start_time: s.start_time,
      end_time: s.end_time ?? null,
      duration_seconds: s.duration_seconds,
      avg_cpu_percent: s.avg_cpu_percent,
      avg_memory_mb: s.avg_memory_mb,
      avg_gpu_percent: s.avg_gpu_percent,
      peak_cpu_percent: s.peak_cpu_percent,
      peak_memory_mb: s.peak_memory_mb,
      peak_gpu_percent: s.peak_gpu_percent,
      is_current: false,
      performance_history: (s.performance_history || []).map(p => ({
        timestamp: p.timestamp,
        cpu_percent: p.cpu_percent,
        memory_mb: p.memory_mb,
        memory_percent: p.memory_percent,
        gpu_percent: p.gpu_percent,
        user_activity_percent: p.user_activity_percent || 0,
        is_foreground: p.is_foreground ?? true,
      })),
    }));

  await invoke('save_app_data', {
    whitelist: savedWhitelist,
    sessions: savedSessions,
    nextSessionId,
  });
}

export async function loadAppData(): Promise<{
  whitelist: WhitelistEntry[];
  sessions: Session[];
  nextSessionId: number;
}> {
  const data = await invoke<AppData>('load_app_data');

  const whitelist: WhitelistEntry[] = data.whitelist.map(w => ({
    id: w.id,
    name: w.name,
    exe_path: w.exe_path ?? undefined,
    added_date: w.added_date,
    is_tracked: w.is_tracked,
  }));

  const sessions: Session[] = data.sessions.map(s => ({
    id: s.id,
    app_name: s.app_name,
    start_time: s.start_time,
    end_time: s.end_time ?? undefined,
    duration_seconds: s.duration_seconds,
    avg_cpu_percent: s.avg_cpu_percent,
    avg_memory_mb: s.avg_memory_mb,
    avg_gpu_percent: s.avg_gpu_percent || 0,
    peak_cpu_percent: s.peak_cpu_percent,
    peak_memory_mb: s.peak_memory_mb,
    peak_gpu_percent: s.peak_gpu_percent || 0,
    is_current: false,
    performance_history: (s.performance_history || []).map(p => ({
      timestamp: p.timestamp,
      cpu_percent: p.cpu_percent,
      memory_mb: p.memory_mb,
      memory_percent: p.memory_percent,
      gpu_percent: p.gpu_percent || 0,
      user_activity_percent: p.user_activity_percent || 0,
      is_foreground: p.is_foreground ?? true,
      keyboard_clicks: p.keyboard_clicks || 0,
      mouse_pixels: p.mouse_pixels || 0,
    })),
  }));

  return {
    whitelist,
    sessions,
    nextSessionId: data.next_session_id || 1,
  };
}

// Signal that main app is ready (triggers splash exit animation)
export async function signalAppReady(): Promise<void> {
  await invoke('signal_app_ready');
}

// Get application icon from exe file as base64 PNG
export async function getAppIcon(exePath: string): Promise<string | null> {
  try {
    return await invoke<string>('get_app_icon', { exePath });
  } catch {
    return null;
  }
}

// User activity result from backend
interface UserActivityResult {
  activity_percent: number;
  is_foreground: boolean;
}

// Global activity result - call ONCE per polling cycle
interface GlobalActivityResult {
  activity_percent: number;
  foreground_pid: number | null;
  keyboard_clicks: number;
  mouse_pixels: number;
}

// Get global user activity - call ONCE per polling cycle (resets counters)
export async function getGlobalActivity(): Promise<GlobalActivityResult> {
  return await invoke<GlobalActivityResult>('get_global_activity');
}

// Check if any of the given PIDs is the foreground window (safe to call multiple times)
export async function checkForeground(pids: number[]): Promise<boolean> {
  return await invoke<boolean>('check_foreground', { pids });
}

// Legacy: Get user activity for tracked processes (deprecated - use getGlobalActivity)
export async function getUserActivity(pids: number[]): Promise<UserActivityResult> {
  return await invoke<UserActivityResult>('get_user_activity', { pids });
}

// Autostart functions
export async function getAutostartEnabled(): Promise<boolean> {
  return await invoke<boolean>('get_autostart_enabled');
}

export async function setAutostartEnabled(enabled: boolean): Promise<void> {
  await invoke('set_autostart_enabled', { enabled });
}
