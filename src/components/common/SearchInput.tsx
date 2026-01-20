import { memo, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchInput = memo(function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
}: SearchInputProps) {
  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-full pl-9 pr-8 py-2 rounded-lg
          bg-bg-card border border-zinc-800
          text-text-primary text-sm
          placeholder:text-text-muted
          focus:outline-none focus:border-accent-blue
          transition-colors duration-150
        "
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
});
