import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  type User as FirebaseUser
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import type { AuthUser, SyncStatus } from '../types/auth';

// Check if running in Tauri v2 - check for __TAURI_INTERNALS__ which is used in v2
function checkIsTauri(): boolean {
  const hasTauriV1 = typeof window !== 'undefined' && '__TAURI__' in window;
  const hasTauriV2 = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  return hasTauriV1 || hasTauriV2;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isOnline: boolean;
  syncStatus: SyncStatus;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function mapFirebaseUser(firebaseUser: FirebaseUser | null): AuthUser | null {
  if (!firebaseUser) return null;
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSynced: null,
    pendingChanges: 0,
    isOnline: navigator.onLine,
    isSyncing: false,
  });

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(mapFirebaseUser(firebaseUser));
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Listen to online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    // Configure provider settings
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });

    const isTauriEnv = checkIsTauri();

    if (isTauriEnv) {
      // In Tauri, use the tauri-plugin-google-auth
      const { signIn } = await import('@choochmeque/tauri-plugin-google-auth-api');

      // Google OAuth credentials from .env file
      const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        throw new Error('Google OAuth credentials not configured. Check .env file.');
      }

      // Sign in with Google via Tauri plugin
      const result = await signIn({
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        scopes: ['email', 'profile', 'openid'],
        successHtmlResponse: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Performance Guard - Signed In</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #000000 0%, #0a0a0a 100%);
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      padding: 48px;
      background: #18181b;
      border-radius: 16px;
      border: 1px solid #27272a;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      max-width: 400px;
    }
    .icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 24px;
      background: linear-gradient(135deg, #3b82f6 0%, #00bfff 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg { width: 32px; height: 32px; fill: white; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    p { color: #a1a1aa; margin-bottom: 24px; }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      padding: 12px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
      border: none;
      font-size: 14px;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px -10px rgba(59, 130, 246, 0.5);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
    </div>
    <h1>Successfully signed in!</h1>
    <p>You can now close this window and return to Performance Guard.</p>
    <button class="button" onclick="window.close()">Close Window</button>
  </div>
</body>
</html>`,
      });

      // The plugin might return different field names
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultAny = result as any;
      const idToken = result?.idToken || resultAny?.id_token;
      const accessToken = result?.accessToken || resultAny?.access_token;

      if (idToken && idToken.includes('.')) {
        // Valid JWT format (contains dots)
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
      } else if (accessToken) {
        // Try using access token instead
        const credential = GoogleAuthProvider.credential(null, accessToken);
        await signInWithCredential(auth, credential);
      } else {
        throw new Error('No valid token received from Google sign-in. Result: ' + JSON.stringify(result));
      }
    } else {
      // In browser, popup works fine
      await signInWithPopup(auth, googleProvider);
    }
  }, []);

  const signOut = useCallback(async () => {
    // Sign out from Firebase
    await firebaseSignOut(auth);

    // Also sign out from Tauri Google Auth if in Tauri
    if (checkIsTauri()) {
      try {
        const { signOut: tauriSignOut } = await import('@choochmeque/tauri-plugin-google-auth-api');
        await tauriSignOut();
      } catch {
        // Ignore errors from Tauri sign out
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isOnline,
      syncStatus,
      signInWithGoogle,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
