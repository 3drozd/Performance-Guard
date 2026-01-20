import { useState } from 'react';
import { X, LogOut, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { user, signInWithGoogle, signOut, isOnline, syncStatus } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: unknown) {
      // Show more detailed error for debugging
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorCode = (err as { code?: string })?.code || '';

      if (errorCode === 'auth/popup-blocked') {
        setError('Popup was blocked. Please allow popups for this site.');
      } else if (errorCode === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled.');
      } else if (errorCode === 'auth/unauthorized-domain') {
        setError('This domain is not authorized. Add it in Firebase Console.');
      } else {
        setError(`Sign-in failed: ${errorCode || errorMessage}`);
      }
      console.error('Sign-in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border-subtle rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-text-primary">Account</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {user ? (
            // Logged in state
            <div className="space-y-4">
              {/* User info */}
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-12 h-12 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-accent-blue/20 flex items-center justify-center">
                    <span className="text-accent-blue text-lg font-semibold">
                      {user.displayName?.[0] || user.email?.[0] || '?'}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {user.displayName || 'User'}
                  </p>
                  <p className="text-xs text-text-muted truncate">{user.email}</p>
                </div>
              </div>

              {/* Sync status */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-elevated">
                {isOnline ? (
                  <>
                    <Cloud size={16} className="text-accent-green" />
                    <span className="text-xs text-text-secondary">
                      {syncStatus.isSyncing ? 'Syncing...' : 'Connected to cloud'}
                    </span>
                  </>
                ) : (
                  <>
                    <CloudOff size={16} className="text-yellow-400" />
                    <span className="text-xs text-text-secondary">
                      Offline - changes saved locally
                    </span>
                  </>
                )}
              </div>

              {/* Sign out button */}
              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-bg-elevated hover:bg-red-500/10 text-text-secondary hover:text-red-400 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <LogOut size={18} />
                )}
                Sign out
              </button>
            </div>
          ) : (
            // Logged out state
            <div className="space-y-4">
              <p className="text-sm text-text-secondary text-center">
                Sign in to sync your data across devices
              </p>

              {error && (
                <p className="text-xs text-red-400 text-center bg-red-400/10 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              {/* Google sign-in button */}
              <button
                onClick={handleSignIn}
                disabled={isLoading || !isOnline}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-white hover:bg-gray-100 text-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Sign in with Google
              </button>

              {!isOnline && (
                <p className="text-xs text-yellow-400 text-center">
                  You're offline. Connect to sign in.
                </p>
              )}

              <p className="text-xs text-text-muted text-center">
                Your data will still be saved locally without signing in
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
