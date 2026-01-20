import { memo, useCallback, useState } from 'react';
import { LayoutDashboard, ListChecks, BarChart3, User, Cloud, CloudOff, Settings } from 'lucide-react';
import { TabButton, AppIcon } from '../common';
import { LoginModal } from '../auth/LoginModal';
import { useAuth } from '../../context/AuthContext';
import type { ViewType } from '../../types';

interface HeaderProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export const Header = memo(function Header({
  activeView,
  onViewChange,
}: HeaderProps) {
  const { user, isOnline } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleDashboardClick = useCallback(() => onViewChange('dashboard'), [onViewChange]);
  const handleWhitelistClick = useCallback(() => onViewChange('whitelist'), [onViewChange]);
  const handleDetailsClick = useCallback(() => onViewChange('details'), [onViewChange]);
  const handleSettingsClick = useCallback(() => onViewChange('settings'), [onViewChange]);

  return (
    <>
    <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-bg-primary">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-blue/20">
          <AppIcon size={24} />
        </div>
        <div className="whitespace-nowrap">
          <h1 className="text-lg font-bold text-text-primary">Performance Guard</h1>
          <p className="text-xs text-text-muted">System Monitor</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-2">
          <TabButton
            icon={LayoutDashboard}
            label="Dashboard"
            isActive={activeView === 'dashboard'}
            onClick={handleDashboardClick}
          />
          <TabButton
            icon={ListChecks}
            label="Whitelist"
            isActive={activeView === 'whitelist'}
            onClick={handleWhitelistClick}
          />
          <TabButton
            icon={BarChart3}
            label="Details"
            isActive={activeView === 'details'}
            onClick={handleDetailsClick}
          />
          <TabButton
            icon={Settings}
            label="Settings"
            isActive={activeView === 'settings'}
            onClick={handleSettingsClick}
          />
        </nav>

        {/* User button */}
        <button
          onClick={() => setShowLoginModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-elevated hover:bg-bg-card-hover transition-colors"
        >
          {user ? (
            <>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="w-6 h-6 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-accent-blue/20 flex items-center justify-center">
                  <span className="text-accent-blue text-xs font-semibold">
                    {user.displayName?.[0] || user.email?.[0] || '?'}
                  </span>
                </div>
              )}
              <div className="w-px h-4 bg-zinc-700" />
              {isOnline ? (
                <Cloud size={14} className="text-accent-green" />
              ) : (
                <CloudOff size={14} className="text-yellow-400" />
              )}
            </>
          ) : (
            <>
              <User size={18} className="text-text-muted" />
              <span className="text-sm text-text-secondary">Sign in</span>
            </>
          )}
        </button>
      </div>
    </header>

    <LoginModal
      isOpen={showLoginModal}
      onClose={() => setShowLoginModal(false)}
    />
    </>
  );
});
