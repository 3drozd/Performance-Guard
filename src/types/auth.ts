export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface SyncStatus {
  lastSynced: Date | null;
  pendingChanges: number;
  isOnline: boolean;
  isSyncing: boolean;
}
