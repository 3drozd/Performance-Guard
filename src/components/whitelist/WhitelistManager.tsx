import { memo, useMemo, useState } from 'react';
import { Trash2, FolderOpen, AppWindow } from 'lucide-react';
import { SearchInput, Button } from '../common';
import { formatDate } from '../../utils/formatters';
import type { WhitelistEntry } from '../../types';

interface WhitelistManagerProps {
  whitelist: WhitelistEntry[];
  icons?: { [name: string]: string };
  onRemove: (id: number) => void;
  onBrowse: () => void;
}

export const WhitelistManager = memo(function WhitelistManager({
  whitelist,
  icons = {},
  onRemove,
  onBrowse,
}: WhitelistManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter whitelist
  const filteredWhitelist = useMemo(() => {
    if (!searchQuery) return whitelist;
    const query = searchQuery.toLowerCase();
    return whitelist.filter(entry => entry.name.toLowerCase().includes(query));
  }, [whitelist, searchQuery]);

  return (
    <div className="glass-card flex flex-col h-full w-[400px] flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-text-primary flex-shrink-0 mr-4">Whitelist<br />Manager</h2>
        <div className="flex items-center gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search whitelist..."
          />
          <Button
            variant="primary"
            size="sm"
            icon={FolderOpen}
            onClick={onBrowse}
          >
            Browse
          </Button>
        </div>
      </div>

      {/* Whitelist entries */}
      <div className="flex-1 overflow-y-scroll overflow-x-hidden">
        {filteredWhitelist.length > 0 ? (
          filteredWhitelist.map(entry => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 last:border-b-0 hover:bg-bg-card-hover transition-colors"
            >
              {/* App icon */}
              {icons[entry.name] ? (
                <img
                  src={`data:image/png;base64,${icons[entry.name]}`}
                  alt=""
                  className="w-8 h-8 rounded-lg flex-shrink-0 object-contain"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0 text-text-muted">
                  <AppWindow size={18} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{entry.name.replace(/\.exe$/i, '')}</p>
                <p className="text-xs text-text-muted truncate">
                  Added: {formatDate(entry.added_date)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {entry.is_tracked && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent-green/20 text-accent-green">
                    Tracking
                  </span>
                )}
                <button
                  onClick={() => onRemove(entry.id)}
                  className="p-1.5 rounded-lg hover:bg-accent-red/20 text-text-muted hover:text-accent-red transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-32 text-text-muted">
            {searchQuery ? 'No matching entries' : 'Whitelist is empty'}
          </div>
        )}
      </div>
    </div>
  );
});
