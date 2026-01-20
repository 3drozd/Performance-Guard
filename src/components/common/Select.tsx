import { memo } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export const Select = memo(function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
}: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full appearance-none px-3 py-2 pr-9 rounded-lg
          bg-bg-card border border-zinc-800
          text-text-primary text-sm
          focus:outline-none focus:border-accent-blue
          transition-colors duration-150
          cursor-pointer
        "
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
    </div>
  );
});
