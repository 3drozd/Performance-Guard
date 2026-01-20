# Performance Guard - Architecture

## Overview

Performance Guard is a desktop application built with **Tauri v2** (Rust backend) and **React** (TypeScript frontend). It monitors system performance and tracks resource usage of whitelisted applications.

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Rust (Tauri v2)
- **Cloud**: Firebase (Auth + Firestore)
- **Build**: Vite + Tauri CLI

## Application Structure

```
Performance Guard (React)/
├── src/                    # React frontend
│   ├── api/
│   │   └── tauri.ts        # Tauri invoke wrappers
│   ├── components/
│   │   ├── auth/           # Login modal, user menu
│   │   ├── common/         # Reusable UI components
│   │   ├── dashboard/      # Dashboard view components
│   │   ├── details/        # Details view components
│   │   ├── layout/         # Header, navigation
│   │   ├── splash/         # Splash screen animation
│   │   └── whitelist/      # Whitelist management
│   ├── config/
│   │   └── firebase.ts     # Firebase configuration
│   ├── context/
│   │   └── AuthContext.tsx # Auth state provider
│   ├── hooks/
│   │   └── useFirestoreSync.ts # Cloud sync logic
│   ├── views/              # Main view containers
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # Main window entry
│   └── splash.tsx          # Splash window entry
├── src-tauri/              # Rust backend
│   └── src/
│       └── main.rs         # All Tauri commands
├── index.html              # Main window HTML
├── splashscreen.html       # Splash window HTML
└── tauri.conf.json         # Tauri configuration
```

## Windows Architecture

The app uses **two separate windows**:

### 1. Splash Window (`splashscreen`)
- **HTML**: `splashscreen.html`
- **Entry**: `src/splash.tsx` → `SplashApp.tsx`
- **Config**: `visible: false`, `transparent: true`, 300x300px
- **Purpose**: Animated loading screen while main app initializes

### 2. Main Window (`main`)
- **HTML**: `index.html`
- **Entry**: `src/main.tsx` → `App.tsx`
- **Config**: `visible: false`, 1200x800px
- **Purpose**: Main application UI

## Splash Screen Flow

```
[App Start]
    ↓
[Splash window created, visible: false]
    ↓
[HTML loads with ghost shield (opacity 15%)]
    ↓
[React renders SplashApp]
    ↓
[useEffect: hide HTML ghost, invoke('show_splash_window')]
    ↓
[Animation: shield draws → particles spawn → rotate]
    ↓
[Main window loads data in background]
    ↓
[Main sends 'app-ready' event]
    ↓
[Splash: lightning flash → zoom → invoke('close_splash_show_main')]
    ↓
[Main window visible, splash closed]
```

## Splash Animation Phases

1. **drawing** (600ms): Shield outline draws with stroke-dashoffset
2. **aura-fadein** (800ms): 12 particles spawn with ease-out timing
3. **pulsing**: Particles rotate with acceleration, trails grow
4. **lightning** (300ms): Flash overlay + lightning bolt SVG
5. **zoom** (250ms): Scale up + fade out → transition to main

## Backend Commands (Rust)

| Command | Description |
|---------|-------------|
| `get_processes` | List all running processes with CPU/memory/GPU |
| `get_system_stats` | System CPU, memory, cores |
| `get_process_by_pid` | Single process info |
| `save_app_data` | Persist whitelist + sessions to JSON |
| `load_app_data` | Load saved data |
| `signal_app_ready` | Emit 'app-ready' event to splash |
| `show_splash_window` | Make splash window visible |
| `close_splash_show_main` | Close splash, show main window |
| `get_app_icon` | Extract icon from .exe as base64 PNG |
| `get_user_activity` | Keyboard/mouse activity + mouse movement for PIDs |

## Data Flow

```
[Rust Backend]
    ↓ invoke()
[src/api/tauri.ts] - Type mapping
    ↓
[App.tsx] - State management (useState, useRef)
    ↓
[Views] - DashboardView, WhitelistView, DetailsView
    ↓
[Components] - UI rendering
```

## Session Tracking

- **SessionTracker** (ref in App.tsx): Tracks per-app sessions
- Sessions start when whitelisted app process detected
- Sessions end when process stops
- Data persisted to `performance_guard_data.json` in app data dir

## Dashboard Metrics

The dashboard displays per-application summary with these metrics:
- **Total Time**: Sum of `duration_seconds` from all sessions
- **Active Time**: Time when `is_foreground && user_activity_percent > 10%`
- **Idle Time**: `Total Time - Active Time`
- **Usage**: Average of (CPU + Memory + GPU) / 3
- **Efficiency**: `(Active Time / Total Time) * 100%`

## Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Main state, session tracking, data fetching |
| `SplashApp.tsx` | Splash animation orchestration |
| `ShieldIcon.tsx` | Shield SVG + AuroraRing container |
| `AuroraRing.tsx` | Canvas particle animation |
| `LightningBolt.tsx` | Lightning flash SVG |
| `main.rs` | All Rust backend logic |
| `tauri.conf.json` | Window configs, app metadata |
| `PerformanceChart.tsx` | Performance chart with tooltips and crosshair |
| `AuthContext.tsx` | Firebase auth state management |
| `useFirestoreSync.ts` | Cloud sync for whitelist and sessions |
| `LoginModal.tsx` | Google sign-in modal |

## Authentication & Cloud Sync

### Firebase Integration
- **Authentication**: Google Sign-In (optional)
- **Database**: Firestore for cloud storage
- **Offline**: IndexedDB persistence enabled

### Data Flow (with Cloud)
```
[User Action] → [Local Save] → [Cloud Sync if logged in]
                     ↓
              [Rust Backend]
                     ↓
              [Local JSON file]

[App Start] → [Load Local] → [Merge with Cloud if logged in]
```

### Firestore Structure
```
/users/{uid}
  ├── whitelist/
  │   └── app_{id}: { name, exe_path, added_date, is_tracked }
  └── sessions/
      └── session_{id}: { app_name, start_time, duration, metrics... }
```

### Sync Strategy
- **Local-first**: Data always saved locally first
- **Cloud sync**: Automatic when user is logged in and online
- **Merge**: On login, local and cloud data are merged (cloud wins on conflict)
- **Offline**: App works fully offline, syncs when back online
