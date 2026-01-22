import { useMemo } from 'react';
import type { Session, WhitelistEntry, AppCategory } from '../types';

export interface DailyStats {
  date: string;
  total_time_seconds: number;
  productive_time_seconds: number; // Work + Development + Productivity
  distractive_time_seconds: number; // Entertainment + Communication + Other
  average_efficiency_percent: number;
  top_apps: Array<{ name: string; time_seconds: number; category?: AppCategory }>;
  session_count: number;
  comparison_yesterday?: {
    productive_time_change_percent: number;
    efficiency_change_percent: number;
  };
}

export function useDailyStats(
  sessions: Session[],
  targetDate: Date = new Date(),
  whitelist: WhitelistEntry[]
): DailyStats {
  return useMemo(() => {
    // 1. Filtruj sesje dla dzisiejszego dnia
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const todaySessions = sessions.filter(s => {
      const startTime = new Date(s.start_time);
      return startTime >= startOfDay && startTime <= endOfDay && !s.is_current;
    });

    // 2. Filtruj sesje wczorajsze dla porównania
    const yesterdayStart = new Date(startOfDay);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(endOfDay);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const yesterdaySessions = sessions.filter(s => {
      const startTime = new Date(s.start_time);
      return startTime >= yesterdayStart && startTime <= yesterdayEnd && !s.is_current;
    });

    // 3. Oblicz statystyki dla obu dni
    const stats = calculateDayStats(todaySessions, whitelist);
    const yesterdayStats = calculateDayStats(yesterdaySessions, whitelist);

    // 4. Oblicz porównanie procentowe
    return {
      ...stats,
      comparison_yesterday: {
        productive_time_change_percent:
          yesterdayStats.productive_time_seconds > 0
            ? ((stats.productive_time_seconds - yesterdayStats.productive_time_seconds) / yesterdayStats.productive_time_seconds) * 100
            : 0,
        efficiency_change_percent:
          yesterdayStats.average_efficiency_percent > 0
            ? stats.average_efficiency_percent - yesterdayStats.average_efficiency_percent
            : 0
      }
    };
  }, [sessions, targetDate, whitelist]);
}

// Helper function do obliczania statystyk dla jednego dnia
function calculateDayStats(sessions: Session[], whitelist: WhitelistEntry[]): Omit<DailyStats, 'comparison_yesterday'> {
  // Mapa kategorie: app_name -> category
  const categoryMap = new Map(whitelist.map(w => [w.name.toLowerCase(), w.category || 'other']));

  let totalTime = 0;
  let productiveTime = 0;
  let distractiveTime = 0;
  let totalActivity = 0;
  let activityCount = 0;

  const appTimeMap = new Map<string, number>();

  sessions.forEach(session => {
    const duration = session.duration_seconds;
    totalTime += duration;

    // Kategoria aplikacji
    const category = categoryMap.get(session.app_name.toLowerCase()) || 'other';

    // Productive categories: work, development, productivity
    if (['work', 'development', 'productivity'].includes(category)) {
      productiveTime += duration;
    } else {
      // Distractive: entertainment, communication, other
      distractiveTime += duration;
    }

    // Efficiency z performance_history (tylko snapshoty is_foreground)
    if (session.performance_history && session.performance_history.length > 0) {
      const foregroundSnapshots = session.performance_history.filter(p => p.is_foreground);
      foregroundSnapshots.forEach(snap => {
        totalActivity += snap.user_activity_percent;
        activityCount++;
      });
    }

    // Agregacja czasu dla top apps
    appTimeMap.set(session.app_name, (appTimeMap.get(session.app_name) || 0) + duration);
  });

  // Top 3 aplikacje (sortuj po czasie malejąco)
  const topApps = Array.from(appTimeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, time_seconds]) => ({
      name,
      time_seconds,
      category: categoryMap.get(name.toLowerCase())
    }));

  return {
    date: sessions[0]?.start_time || new Date().toISOString(),
    total_time_seconds: totalTime,
    productive_time_seconds: productiveTime,
    distractive_time_seconds: distractiveTime,
    average_efficiency_percent: activityCount > 0 ? totalActivity / activityCount : 0,
    top_apps: topApps,
    session_count: sessions.length
  };
}
