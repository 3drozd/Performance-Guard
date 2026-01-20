// Utility functions for formatting values

export const formatCpuPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export const formatMemoryMB = (value: number): string => {
  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} GB`;
  }
  return `${value.toFixed(1)} MB`;
};

export const formatMemoryPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const formatDurationCompact = (seconds: number): string => {
  if (seconds < 60) {
    return '<1m';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
};

export const formatEfficiencyBadge = (percent: number): { color: string; bg: string } => {
  if (percent >= 70) {
    return { color: 'text-accent-green', bg: 'bg-accent-green/20' };
  }
  if (percent >= 40) {
    return { color: 'text-yellow-400', bg: 'bg-yellow-400/20' };
  }
  return { color: 'text-red-400', bg: 'bg-red-400/20' };
};

export const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatRelativeTime = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return formatDate(isoString);
};

export const truncatePath = (path: string, maxLength: number = 50): string => {
  if (path.length <= maxLength) {
    return path;
  }

  const parts = path.split('\\');
  if (parts.length <= 2) {
    return `...${path.slice(-maxLength + 3)}`;
  }

  const first = parts[0];
  const last = parts[parts.length - 1];

  if (first.length + last.length + 5 > maxLength) {
    return `...${last.slice(-maxLength + 3)}`;
  }

  return `${first}\\...\\${last}`;
};
