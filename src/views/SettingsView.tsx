import { memo, useState, useEffect } from 'react';
import { Settings, Power, Download, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { AnimatedContainer, AnimatedItem } from '../components/common';
import { getAutostartEnabled, setAutostartEnabled } from '../api/tauri';
import { useAppUpdater } from '../hooks/useAppUpdater';

const APP_VERSION = '1.0.0';

interface SettingsViewProps {
  isActive: boolean;
  initiallyHidden?: boolean;
}

export const SettingsView = memo(function SettingsView({
  isActive,
  initiallyHidden = false,
}: SettingsViewProps) {
  const [autostartEnabled, setAutostartState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {
    status: updateStatus,
    progress: updateProgress,
    updateInfo,
    error: updateError,
    checkForUpdates,
    downloadAndInstall,
    restart,
  } = useAppUpdater();

  // Load autostart state on mount
  useEffect(() => {
    getAutostartEnabled()
      .then(enabled => {
        setAutostartState(enabled);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const handleAutostartToggle = async () => {
    const newValue = !autostartEnabled;
    setAutostartState(newValue);
    try {
      await setAutostartEnabled(newValue);
    } catch {
      // Revert on error
      setAutostartState(!newValue);
    }
  };

  return (
    <AnimatedContainer
      isActive={isActive}
      staggerDelay={100}
      initialDelay={100}
      className="flex flex-col gap-6 p-6 h-full overflow-auto min-w-[812px]"
      initiallyHidden={initiallyHidden}
    >
      {/* Header */}
      <AnimatedItem className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
          <Settings className="w-5 h-5 text-zinc-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-500">Configure application preferences</p>
        </div>
      </AnimatedItem>

      {/* Settings Cards */}
      <AnimatedItem>
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
          {/* Startup Section */}
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-300">Startup</h2>
          </div>

          {/* Autostart Toggle */}
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Power className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">Start with Windows</p>
                <p className="text-xs text-zinc-500">Launch Performance Guard when you log in</p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={handleAutostartToggle}
              disabled={isLoading}
              className={`
                relative w-11 h-6 rounded-full transition-colors duration-200
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${autostartEnabled ? 'bg-blue-500' : 'bg-zinc-700'}
              `}
            >
              <span
                className={`
                  absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white
                  transition-transform duration-200 shadow-sm
                  ${autostartEnabled ? 'translate-x-5' : 'translate-x-0'}
                `}
              />
            </button>
          </div>
        </div>
      </AnimatedItem>

      {/* Updates Section */}
      <AnimatedItem>
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-300">Updates</h2>
          </div>

          <div className="px-5 py-4">
            {/* Current version */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Download className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">Current Version</p>
                  <p className="text-xs text-zinc-500">v{APP_VERSION}</p>
                </div>
              </div>

              {/* Status indicator */}
              <div className="flex items-center gap-2">
                {updateStatus === 'checking' && (
                  <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Checking...
                  </span>
                )}
                {updateStatus === 'up-to-date' && (
                  <span className="flex items-center gap-1.5 text-xs text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    Up to date
                  </span>
                )}
                {updateStatus === 'available' && (
                  <span className="flex items-center gap-1.5 text-xs text-blue-400">
                    <Download className="w-3 h-3" />
                    v{updateInfo?.version} available
                  </span>
                )}
                {updateStatus === 'error' && (
                  <span className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    Error
                  </span>
                )}
                {updateStatus === 'ready' && (
                  <span className="flex items-center gap-1.5 text-xs text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    Ready to restart
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar for downloading */}
            {updateStatus === 'downloading' && (
              <div className="mb-4">
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${updateProgress}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1 text-center">
                  Downloading... {updateProgress}%
                </p>
              </div>
            )}

            {/* Error message */}
            {updateError && (
              <p className="text-xs text-red-400 mb-4">{updateError}</p>
            )}

            {/* Update notes */}
            {updateInfo?.body && updateStatus === 'available' && (
              <p className="text-xs text-zinc-500 mb-4 line-clamp-2">
                {updateInfo.body}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {updateStatus === 'checking' && (
                <button
                  disabled
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm opacity-50 cursor-not-allowed"
                >
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Checking...
                </button>
              )}
              {(updateStatus === 'idle' || updateStatus === 'up-to-date' || updateStatus === 'error') && (
                <button
                  onClick={checkForUpdates}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Check for Updates
                </button>
              )}
              {updateStatus === 'available' && (
                <button
                  onClick={downloadAndInstall}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download & Install
                </button>
              )}
              {updateStatus === 'ready' && (
                <button
                  onClick={restart}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Restart Now
                </button>
              )}
            </div>
          </div>
        </div>
      </AnimatedItem>

      {/* About Section */}
      <AnimatedItem>
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-300">About</h2>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-zinc-400">Performance Guard v{APP_VERSION}</p>
            <p className="text-xs text-zinc-500 mt-1">Monitor and track your application performance</p>
          </div>
        </div>
      </AnimatedItem>
    </AnimatedContainer>
  );
});
