import { memo, useEffect, useState } from 'react';
import { Download, X, RefreshCw, CheckCircle } from 'lucide-react';
import { useAppUpdater } from '../../hooks/useAppUpdater';

export const UpdateNotification = memo(function UpdateNotification() {
  const { status, progress, updateInfo, checkForUpdates, downloadAndInstall, restart } = useAppUpdater();
  const [dismissed, setDismissed] = useState(false);

  // Check for updates on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 3000); // Check 3 seconds after app starts

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  // Don't show if dismissed or no update available
  if (dismissed || status === 'idle' || status === 'checking' || status === 'up-to-date' || status === 'error') {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-4 w-80">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {status === 'ready' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <Download className="w-5 h-5 text-blue-400" />
            )}
            <span className="font-medium text-zinc-100">
              {status === 'ready' ? 'Ready to restart' : 'Update Available'}
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Version info */}
        {updateInfo && (
          <div className="mb-3">
            <p className="text-sm text-zinc-300">
              Version {updateInfo.version} is available
            </p>
            {updateInfo.body && (
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                {updateInfo.body}
              </p>
            )}
          </div>
        )}

        {/* Progress bar */}
        {status === 'downloading' && (
          <div className="mb-3">
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1 text-center">
              Downloading... {progress}%
            </p>
          </div>
        )}

        {/* Action button */}
        <button
          onClick={status === 'ready' ? restart : downloadAndInstall}
          disabled={status === 'downloading'}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg
            font-medium text-sm transition-colors
            ${status === 'downloading'
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : status === 'ready'
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }
          `}
        >
          {status === 'downloading' ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Downloading...
            </>
          ) : status === 'ready' ? (
            <>
              <RefreshCw className="w-4 h-4" />
              Restart Now
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download & Install
            </>
          )}
        </button>
      </div>
    </div>
  );
});
