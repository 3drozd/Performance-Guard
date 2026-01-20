import { memo } from 'react';
import type { LucideIcon } from 'lucide-react';

interface TabButtonProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export const TabButton = memo(function TabButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm
        transition-colors duration-150
        ${isActive
          ? 'bg-accent-blue text-white'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-card-hover'
        }
      `}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
});
