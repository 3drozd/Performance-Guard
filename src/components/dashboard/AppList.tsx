import { memo, useMemo, useState, useCallback } from 'react';
import { AppRow } from './AppRow';
import { SearchInput, Pagination, SortableHeader, Select } from '../common';
import { exportData } from '../../utils/export';
import type { AppSummary, SortField, SortDirection, ExportFormat } from '../../types';

interface AppListProps {
  apps: AppSummary[];
  onSelectApp: (appName: string) => void;
}

const PAGE_SIZE = 10;

export const AppList = memo(function AppList({ apps, onSelectApp }: AppListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showRunningOnly, setShowRunningOnly] = useState(false);

  // Filter and sort apps
  const filteredAndSortedApps = useMemo(() => {
    let result = [...apps];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(app => app.name.toLowerCase().includes(query));
    }

    // Filter by running status
    if (showRunningOnly) {
      result = result.filter(app => app.is_running);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'total_time':
          comparison = a.total_time_seconds - b.total_time_seconds;
          break;
        case 'active_time':
          comparison = a.active_time_seconds - b.active_time_seconds;
          break;
        case 'usage':
          comparison = a.avg_usage_percent - b.avg_usage_percent;
          break;
        case 'efficiency':
          comparison = a.efficiency_percent - b.efficiency_percent;
          break;
        case 'sessions':
          comparison = a.session_count - b.session_count;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [apps, searchQuery, sortField, sortDirection, showRunningOnly]);

  // Pagination
  const totalPages = useMemo(() => Math.ceil(filteredAndSortedApps.length / PAGE_SIZE), [filteredAndSortedApps.length]);
  const paginatedApps = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSortedApps.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedApps, currentPage]);

  // Reset page when filters change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  }, [sortField]);

  const handleExport = useCallback((format: ExportFormat) => {
    exportData(filteredAndSortedApps, format, 'tracked-apps');
  }, [filteredAndSortedApps]);

  return (
    <div className="glass-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-text-primary">Tracked Applications</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={showRunningOnly}
              onChange={(e) => {
                setShowRunningOnly(e.target.checked);
                setCurrentPage(1);
              }}
              className="w-4 h-4 rounded border-zinc-700 bg-bg-elevated text-accent-blue focus:ring-accent-blue focus:ring-offset-0"
            />
            Running only
          </label>
          <SearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search apps..."
          />
          <Select
            value=""
            onChange={(value) => handleExport(value as ExportFormat)}
            options={[
              { value: 'csv', label: 'Export CSV' },
              { value: 'json', label: 'Export JSON' },
            ]}
            placeholder="Export"
            className="w-32"
          />
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_90px_140px_80px_90px_40px] items-center justify-items-center gap-4 px-4 py-2.5 bg-bg-elevated border-b border-zinc-800">
        <SortableHeader
          label="Application"
          field="name"
          currentField={sortField}
          currentDirection={sortDirection}
          onSort={handleSort}
          className="justify-self-start"
        />
        <SortableHeader
          label="Time"
          field="total_time"
          currentField={sortField}
          currentDirection={sortDirection}
          onSort={handleSort}
        />
        <SortableHeader
          label="Active / Idle"
          field="active_time"
          currentField={sortField}
          currentDirection={sortDirection}
          onSort={handleSort}
        />
        <SortableHeader
          label="Usage"
          field="usage"
          currentField={sortField}
          currentDirection={sortDirection}
          onSort={handleSort}
          className="justify-center"
        />
        <SortableHeader
          label="Efficiency"
          field="efficiency"
          currentField={sortField}
          currentDirection={sortDirection}
          onSort={handleSort}
          className="justify-center"
        />
        <div />
      </div>

      {/* App rows */}
      <div className="flex-1 overflow-auto">
        {paginatedApps.length > 0 ? (
          paginatedApps.map(app => (
            <AppRow key={app.name} app={app} onSelect={onSelectApp} />
          ))
        ) : (
          <div className="flex items-center justify-center h-32 text-text-muted">
            No applications found
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        pageSize={PAGE_SIZE}
        totalItems={filteredAndSortedApps.length}
      />
    </div>
  );
});
