import { memo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import type { SortDirection, SortField } from '../../types';

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}

export const SortableHeader = memo(function SortableHeader({
  label,
  field,
  currentField,
  currentDirection,
  onSort,
  className = '',
}: SortableHeaderProps) {
  const isActive = currentField === field;

  const Icon = isActive
    ? currentDirection === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <button
      onClick={() => onSort(field)}
      className={`
        inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider
        ${isActive ? 'text-accent-blue' : 'text-text-muted hover:text-text-secondary'}
        transition-colors duration-150
        ${className}
      `}
    >
      {label}
      <Icon size={12} />
    </button>
  );
});
