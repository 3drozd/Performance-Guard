#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use sysinfo::{System, Pid};
use std::sync::Mutex;
use std::fs;
use std::path::PathBuf;
use tauri::{
    State, Manager, Emitter,
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
    menu::{Menu, MenuItem},
};

#[cfg(windows)]
use windows::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS_EX};
#[cfg(windows)]
use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
#[cfg(windows)]
use windows::Win32::Foundation::CloseHandle;
#[cfg(windows)]
use windows::Win32::UI::Shell::ExtractIconExW;
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO};
#[cfg(windows)]
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, SelectObject, GetObjectW,
    BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, BITMAP,
};
#[cfg(windows)]
use windows::core::PCWSTR;
#[cfg(windows)]
use nvml_wrapper::Nvml;
#[cfg(windows)]
use std::ffi::OsStr;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
use std::collections::HashMap;

struct AppState {
    system: Mutex<System>,
    data_path: PathBuf,
}

#[derive(Serialize)]
struct ProcessInfo {
    pid: u32,
    name: String,
    cpu_percent: f32,
    memory_mb: f64,
    memory_percent: f32,
    gpu_percent: f32,
    status: String,
    create_time: u64,
    exe_path: Option<String>,
}

#[derive(Serialize)]
struct SystemStats {
    cpu_percent: f32,
    memory_percent: f32,
    total_memory_gb: f64,
    used_memory_gb: f64,
    available_memory_gb: f64,
    cpu_cores: usize,
}

/// Get Private Working Set memory for a process using Windows API
/// This matches what Task Manager shows in the "Memory" column (Private Working Set)
#[cfg(windows)]
fn get_private_working_set(pid: u32) -> Option<u64> {
    unsafe {
        let handle = OpenProcess(
            PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
            false,
            pid,
        ).ok()?;

        let mut pmc = PROCESS_MEMORY_COUNTERS_EX::default();
        pmc.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS_EX>() as u32;

        let result = GetProcessMemoryInfo(
            handle,
            std::mem::transmute(&mut pmc),
            std::mem::size_of::<PROCESS_MEMORY_COUNTERS_EX>() as u32,
        );

        let _ = CloseHandle(handle);

        if result.is_ok() {
            // PrivateUsage is the Private Working Set - exactly what Task Manager shows
            Some(pmc.PrivateUsage as u64)
        } else {
            None
        }
    }
}

#[cfg(not(windows))]
fn get_private_working_set(_pid: u32) -> Option<u64> {
    None
}

/// Get GPU usage per process using NVML (NVIDIA only)
/// Returns a HashMap of PID -> GPU utilization percentage
#[cfg(windows)]
fn get_gpu_usage_per_process() -> HashMap<u32, f32> {
    let mut gpu_usage: HashMap<u32, f32> = HashMap::new();

    // Try to initialize NVML
    let nvml = match Nvml::init() {
        Ok(nvml) => nvml,
        Err(_) => return gpu_usage, // No NVIDIA GPU or driver not installed
    };

    // Get first GPU (device 0)
    let device = match nvml.device_by_index(0) {
        Ok(device) => device,
        Err(_) => return gpu_usage,
    };

    // Get running compute processes
    if let Ok(processes) = device.running_compute_processes() {
        for proc in processes {
            // NVML doesn't give per-process GPU utilization directly
            // We can only get memory usage per process
            // For utilization, we'll use the overall GPU utilization divided by process count
            gpu_usage.insert(proc.pid, 0.0);
        }
    }

    // Get running graphics processes
    if let Ok(processes) = device.running_graphics_processes() {
        let process_count = processes.len() as f32;

        // Get overall GPU utilization
        let overall_util = device.utilization_rates()
            .map(|u| u.gpu as f32)
            .unwrap_or(0.0);

        // Distribute utilization among graphics processes (rough approximation)
        let per_process_util = if process_count > 0.0 {
            overall_util / process_count
        } else {
            0.0
        };

        for proc in processes {
            gpu_usage.insert(proc.pid, per_process_util);
        }
    }

    gpu_usage
}

#[cfg(not(windows))]
fn get_gpu_usage_per_process() -> HashMap<u32, f32> {
    HashMap::new()
}

/// Get the process ID of the foreground window
#[cfg(windows)]
fn get_foreground_process_id() -> Option<u32> {
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid > 0 { Some(pid) } else { None }
    }
}

#[cfg(not(windows))]
fn get_foreground_process_id() -> Option<u32> {
    None
}

// Static state for tracking activity between calls
use std::sync::atomic::{AtomicU32, AtomicI32, Ordering};

// Keyboard hook click counter - incremented by low-level keyboard hook
static KEYBOARD_HOOK_CLICKS: AtomicU32 = AtomicU32::new(0);
// Mouse movement accumulator (in pixels)
static MOUSE_DISTANCE: AtomicU32 = AtomicU32::new(0);
// Previous cursor position for movement calculation
static PREV_CURSOR_X: AtomicI32 = AtomicI32::new(0);
static PREV_CURSOR_Y: AtomicI32 = AtomicI32::new(0);

// Low-level input hooks for accurate activity tracking
// Both keyboard and mouse hooks need a message loop to work properly
#[cfg(windows)]
mod input_hooks {
    use super::*;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowsHookExW, CallNextHookEx, GetMessageW,
        WH_KEYBOARD_LL, WH_MOUSE_LL, HHOOK, MSLLHOOKSTRUCT, MSG,
    };
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::Foundation::{WPARAM, LPARAM, LRESULT, HWND};
    use windows::core::PCWSTR;
    use std::sync::atomic::Ordering;
    use std::thread;

    const WM_KEYDOWN: u32 = 0x0100;
    const WM_SYSKEYDOWN: u32 = 0x0104;
    const WM_MOUSEMOVE: u32 = 0x0200;

    unsafe extern "system" fn keyboard_hook_proc(
        code: i32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if code >= 0 {
            let msg = wparam.0 as u32;
            if msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN {
                KEYBOARD_HOOK_CLICKS.fetch_add(1, Ordering::SeqCst);
            }
        }
        CallNextHookEx(HHOOK::default(), code, wparam, lparam)
    }

    unsafe extern "system" fn mouse_hook_proc(
        code: i32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if code >= 0 && wparam.0 as u32 == WM_MOUSEMOVE {
            let mouse_struct = &*(lparam.0 as *const MSLLHOOKSTRUCT);
            let x = mouse_struct.pt.x;
            let y = mouse_struct.pt.y;

            let prev_x = PREV_CURSOR_X.swap(x, Ordering::SeqCst);
            let prev_y = PREV_CURSOR_Y.swap(y, Ordering::SeqCst);

            // Calculate distance if we have previous position
            if prev_x != 0 || prev_y != 0 {
                let dx = (x - prev_x) as f32;
                let dy = (y - prev_y) as f32;
                let dist = (dx * dx + dy * dy).sqrt() as u32;
                if dist > 0 {
                    MOUSE_DISTANCE.fetch_add(dist, Ordering::SeqCst);
                }
            }
        }
        CallNextHookEx(HHOOK::default(), code, wparam, lparam)
    }

    pub fn setup() {
        // Spawn a dedicated thread for input hooks with message loop
        thread::spawn(|| {
            unsafe {
                // Get module handle for hooks
                let hinstance = GetModuleHandleW(PCWSTR::null()).unwrap_or_default();

                // Install keyboard hook
                let kb_hook = SetWindowsHookExW(
                    WH_KEYBOARD_LL,
                    Some(keyboard_hook_proc),
                    hinstance,
                    0,
                );

                // Install mouse hook
                let mouse_hook = SetWindowsHookExW(
                    WH_MOUSE_LL,
                    Some(mouse_hook_proc),
                    hinstance,
                    0,
                );

                // Log errors only
                if kb_hook.is_err() {
                    eprintln!("[ERROR] Failed to install keyboard hook");
                }
                if mouse_hook.is_err() {
                    eprintln!("[ERROR] Failed to install mouse hook");
                }

                // Message loop - required for low-level hooks to work
                let mut msg = MSG::default();
                while GetMessageW(&mut msg, HWND::default(), 0, 0).as_bool() {
                    // Just pump messages, hooks handle the rest
                }
            }
        });
    }
}

/// Raw activity data from input hooks
struct RawActivityData {
    activity_percent: f32,
    keyboard_clicks: u32,
    mouse_pixels: u32,
}

/// Get global user activity (keyboard/mouse) - call ONCE per polling cycle
/// Returns activity percentage (0-100) combining:
/// - Keyboard presses: up to 100% (12 keystrokes per 2 seconds = 100%)
/// - Mouse movement: up to 50% bonus (800 pixels per 2 seconds = 50%)
/// Total capped at 100%
#[cfg(windows)]
fn calculate_global_activity() -> RawActivityData {
    // Get and reset counters - both hooks capture input continuously
    let clicks = KEYBOARD_HOOK_CLICKS.swap(0, Ordering::SeqCst);
    let total_mouse_dist = MOUSE_DISTANCE.swap(0, Ordering::SeqCst);

    // Calculate activity scores:
    // - Keyboard: 12 keystrokes in 2 seconds = 100% (can reach 100% alone)
    // - Mouse: 800 pixels of movement in 2 seconds = 50% (bonus)
    let click_score = (clicks as f32 / 12.0 * 100.0).min(100.0);
    let mouse_score = (total_mouse_dist as f32 / 800.0 * 50.0).min(50.0);

    // Combined activity capped at 100%
    let activity_percent = (click_score + mouse_score).min(100.0);

    RawActivityData {
        activity_percent,
        keyboard_clicks: clicks,
        mouse_pixels: total_mouse_dist,
    }
}

#[cfg(not(windows))]
fn calculate_global_activity() -> RawActivityData {
    RawActivityData {
        activity_percent: 0.0,
        keyboard_clicks: 0,
        mouse_pixels: 0,
    }
}

#[derive(Serialize)]
struct UserActivityResult {
    activity_percent: f32,
    is_foreground: bool,
}

#[derive(Serialize)]
struct GlobalActivityResult {
    activity_percent: f32,
    foreground_pid: Option<u32>,
    keyboard_clicks: u32,
    mouse_pixels: u32,
}

/// Get global activity and foreground PID - call ONCE per polling cycle
/// This resets the input counters, so it should only be called once
#[tauri::command]
fn get_global_activity() -> GlobalActivityResult {
    let raw = calculate_global_activity();
    let foreground_pid = get_foreground_process_id();

    GlobalActivityResult {
        activity_percent: raw.activity_percent,
        foreground_pid,
        keyboard_clicks: raw.keyboard_clicks,
        mouse_pixels: raw.mouse_pixels,
    }
}

/// Check if any of the given PIDs is the foreground window
/// Does NOT reset activity counters - safe to call multiple times
#[tauri::command]
fn check_foreground(pids: Vec<u32>) -> bool {
    let foreground_pid = get_foreground_process_id();
    foreground_pid
        .map(|pid| pids.contains(&pid))
        .unwrap_or(false)
}

/// Legacy function - now just checks foreground status
/// Activity should be obtained via get_global_activity() once per cycle
#[tauri::command]
fn get_user_activity(pids: Vec<u32>) -> UserActivityResult {
    let foreground_pid = get_foreground_process_id();
    let is_foreground = foreground_pid
        .map(|pid| pids.contains(&pid))
        .unwrap_or(false);

    // Don't calculate activity here - use get_global_activity() instead
    // Return 0 to indicate this function shouldn't be used for activity
    UserActivityResult { activity_percent: 0.0, is_foreground }
}

#[tauri::command]
fn get_processes(state: State<AppState>) -> Vec<ProcessInfo> {
    let mut system = state.system.lock().unwrap();
    // Clear and refresh processes to ensure dead processes are removed
    // refresh_all() keeps dead processes in cache, so we need refresh_processes()
    system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    // Get CPU core count for normalization (sysinfo reports per-core CPU usage)
    let cpu_cores = system.cpus().len() as f32;
    let cpu_divisor = if cpu_cores > 0.0 { cpu_cores } else { 1.0 };

    let total_memory = system.total_memory();

    // Get GPU usage per process
    let gpu_usage = get_gpu_usage_per_process();

    let mut processes: Vec<ProcessInfo> = system
        .processes()
        .iter()
        .map(|(pid, process)| {
            let pid_u32 = pid.as_u32();

            // Try to get accurate memory from Windows API, fallback to sysinfo
            let memory_bytes = get_private_working_set(pid_u32)
                .unwrap_or_else(|| process.memory());

            let memory_percent = if total_memory > 0 {
                (memory_bytes as f64 / total_memory as f64 * 100.0) as f32
            } else {
                0.0
            };

            // Normalize CPU usage by dividing by core count
            // sysinfo returns per-core percentage (can exceed 100% on multi-core)
            // We want total system percentage (0-100%)
            let normalized_cpu = process.cpu_usage() / cpu_divisor;

            // Convert bytes to MB
            let memory_mb = memory_bytes as f64 / (1024.0 * 1024.0);

            // Get GPU usage for this process (0 if not using GPU)
            let gpu_percent = gpu_usage.get(&pid_u32).copied().unwrap_or(0.0);

            ProcessInfo {
                pid: pid_u32,
                name: process.name().to_string_lossy().to_string(),
                cpu_percent: normalized_cpu,
                memory_mb,
                memory_percent,
                gpu_percent,
                status: format!("{:?}", process.status()),
                create_time: process.start_time(),
                exe_path: process.exe().map(|p| p.to_string_lossy().to_string()),
            }
        })
        .collect();

    // Sort by CPU usage descending
    processes.sort_by(|a, b| b.cpu_percent.partial_cmp(&a.cpu_percent).unwrap_or(std::cmp::Ordering::Equal));

    processes
}

#[tauri::command]
fn get_system_stats(state: State<AppState>) -> SystemStats {
    let mut system = state.system.lock().unwrap();
    system.refresh_all();

    let total_memory = system.total_memory();
    let used_memory = system.used_memory();
    let available_memory = system.available_memory();

    // Calculate average CPU usage across all cores
    let cpu_percent = system.global_cpu_usage();

    SystemStats {
        cpu_percent,
        memory_percent: if total_memory > 0 {
            (used_memory as f64 / total_memory as f64 * 100.0) as f32
        } else {
            0.0
        },
        total_memory_gb: total_memory as f64 / 1024.0 / 1024.0 / 1024.0,
        used_memory_gb: used_memory as f64 / 1024.0 / 1024.0 / 1024.0,
        available_memory_gb: available_memory as f64 / 1024.0 / 1024.0 / 1024.0,
        cpu_cores: system.cpus().len(),
    }
}

#[tauri::command]
fn get_process_by_pid(state: State<AppState>, pid: u32) -> Option<ProcessInfo> {
    let mut system = state.system.lock().unwrap();
    system.refresh_all();

    let pid_obj = Pid::from_u32(pid);
    let total_memory = system.total_memory();
    let gpu_usage = get_gpu_usage_per_process();

    system.process(pid_obj).map(|process| {
        // Try to get accurate memory from Windows API, fallback to sysinfo
        let memory_bytes = get_private_working_set(pid)
            .unwrap_or_else(|| process.memory());

        let memory_percent = if total_memory > 0 {
            (memory_bytes as f64 / total_memory as f64 * 100.0) as f32
        } else {
            0.0
        };

        let gpu_percent = gpu_usage.get(&pid).copied().unwrap_or(0.0);

        ProcessInfo {
            pid,
            name: process.name().to_string_lossy().to_string(),
            cpu_percent: process.cpu_usage(),
            memory_mb: memory_bytes as f64 / 1024.0 / 1024.0,
            memory_percent,
            gpu_percent,
            status: format!("{:?}", process.status()),
            create_time: process.start_time(),
            exe_path: process.exe().map(|p| p.to_string_lossy().to_string()),
        }
    })
}

// Performance snapshot for charts
#[derive(Serialize, Deserialize, Clone)]
struct PerformanceSnapshot {
    timestamp: String,
    cpu_percent: f64,
    memory_mb: f64,
    memory_percent: f64,
    #[serde(default)]
    gpu_percent: f64,
    #[serde(default)]
    user_activity_percent: f64,
    #[serde(default)]
    is_foreground: bool,
}

// Session and whitelist persistence structures
#[derive(Serialize, Deserialize, Clone)]
struct SavedSession {
    id: i64,
    app_name: String,
    start_time: String,
    end_time: Option<String>,
    duration_seconds: i64,
    avg_cpu_percent: f64,
    avg_memory_mb: f64,
    #[serde(default)]
    avg_gpu_percent: f64,
    peak_cpu_percent: f64,
    peak_memory_mb: f64,
    #[serde(default)]
    peak_gpu_percent: f64,
    is_current: bool,
    #[serde(default)]
    performance_history: Vec<PerformanceSnapshot>,
}

#[derive(Serialize, Deserialize, Clone)]
struct SavedWhitelistEntry {
    id: i64,
    name: String,
    exe_path: Option<String>,
    added_date: String,
    is_tracked: bool,
}

#[derive(Serialize, Deserialize, Default)]
struct AppData {
    whitelist: Vec<SavedWhitelistEntry>,
    sessions: Vec<SavedSession>,
    next_session_id: i64,
}

fn get_data_file_path(state: &State<AppState>) -> PathBuf {
    state.data_path.join("performance_guard_data.json")
}

#[tauri::command]
fn save_app_data(state: State<AppState>, whitelist: Vec<SavedWhitelistEntry>, sessions: Vec<SavedSession>, next_session_id: i64) -> Result<(), String> {
    let data = AppData {
        whitelist,
        sessions,
        next_session_id,
    };

    let data_file = get_data_file_path(&state);

    // Ensure directory exists
    if let Some(parent) = data_file.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&data_file, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn load_app_data(state: State<AppState>) -> Result<AppData, String> {
    let data_file = get_data_file_path(&state);

    if !data_file.exists() {
        return Ok(AppData::default());
    }

    let content = fs::read_to_string(&data_file).map_err(|e| e.to_string())?;
    let data: AppData = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    Ok(data)
}

// Autostart commands
#[tauri::command]
fn get_autostart_enabled(app: tauri::AppHandle) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn set_autostart_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())
    } else {
        manager.disable().map_err(|e| e.to_string())
    }
}

// Emits event to splash window when main app is ready
#[tauri::command]
async fn signal_app_ready(app: tauri::AppHandle) -> Result<(), String> {
    // Emit global event that splash window can listen to
    app.emit("app-ready", ()).map_err(|e| e.to_string())?;
    Ok(())
}

// Shows splash window when DOM is ready
#[tauri::command]
async fn show_splash_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splashscreen") {
        splash.show().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Closes splash and shows main window (called after animation completes)
#[tauri::command]
async fn close_splash_show_main(app: tauri::AppHandle) -> Result<(), String> {
    // Show main window BEFORE closing splash
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
    }
    // Close splash
    if let Some(splash) = app.get_webview_window("splashscreen") {
        splash.close().map_err(|e| e.to_string())?;
    }
    // Trigger panel animation in main window after it's shown
    app.emit("trigger-panel-animation", ()).map_err(|e| e.to_string())?;
    Ok(())
}

/// Extract application icon from exe file and return as base64 PNG
#[tauri::command]
#[cfg(windows)]
fn get_app_icon(exe_path: String) -> Result<String, String> {
    use image::{ImageBuffer, Rgba};
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    unsafe {
        // Convert path to wide string
        let wide_path: Vec<u16> = OsStr::new(&exe_path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // Extract large icon (32x32)
        let mut large_icon: HICON = HICON::default();
        let count = ExtractIconExW(
            PCWSTR::from_raw(wide_path.as_ptr()),
            0,
            Some(&mut large_icon),
            None,
            1,
        );

        if count == 0 || large_icon.is_invalid() {
            return Err("No icon found".to_string());
        }

        // Get icon info to access the bitmap
        let mut icon_info = ICONINFO::default();
        if GetIconInfo(large_icon, &mut icon_info).is_err() {
            DestroyIcon(large_icon).ok();
            return Err("Failed to get icon info".to_string());
        }

        // Get bitmap dimensions
        let hdc = CreateCompatibleDC(None);
        if hdc.is_invalid() {
            if !icon_info.hbmColor.is_invalid() {
                DeleteObject(icon_info.hbmColor).ok();
            }
            if !icon_info.hbmMask.is_invalid() {
                DeleteObject(icon_info.hbmMask).ok();
            }
            DestroyIcon(large_icon).ok();
            return Err("Failed to create DC".to_string());
        }

        let bitmap_to_use = if !icon_info.hbmColor.is_invalid() {
            icon_info.hbmColor
        } else {
            icon_info.hbmMask
        };

        // Get actual bitmap dimensions
        let mut bm = BITMAP::default();
        let bm_result = GetObjectW(
            bitmap_to_use,
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bm as *mut _ as *mut _),
        );

        if bm_result == 0 {
            DeleteDC(hdc).ok();
            if !icon_info.hbmColor.is_invalid() {
                DeleteObject(icon_info.hbmColor).ok();
            }
            if !icon_info.hbmMask.is_invalid() {
                DeleteObject(icon_info.hbmMask).ok();
            }
            DestroyIcon(large_icon).ok();
            return Err("Failed to get bitmap info".to_string());
        }

        let width = bm.bmWidth;
        let height = bm.bmHeight.abs(); // Height can be negative

        // Setup bitmap info for 32-bit RGBA with actual dimensions
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // Negative for top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [Default::default()],
        };

        // Allocate buffer for pixel data
        let mut pixels: Vec<u8> = vec![0u8; (width * height * 4) as usize];

        let old_bitmap = SelectObject(hdc, bitmap_to_use);
        let result = GetDIBits(
            hdc,
            bitmap_to_use,
            0,
            height as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );
        SelectObject(hdc, old_bitmap);

        // Cleanup GDI objects
        DeleteDC(hdc).ok();
        if !icon_info.hbmColor.is_invalid() {
            DeleteObject(icon_info.hbmColor).ok();
        }
        if !icon_info.hbmMask.is_invalid() {
            DeleteObject(icon_info.hbmMask).ok();
        }
        DestroyIcon(large_icon).ok();

        if result == 0 {
            return Err("Failed to get bitmap bits".to_string());
        }

        // Convert BGRA to RGBA
        for chunk in pixels.chunks_mut(4) {
            chunk.swap(0, 2); // Swap B and R
        }

        // Create image from pixels with actual dimensions
        let img: ImageBuffer<Rgba<u8>, Vec<u8>> = match ImageBuffer::from_raw(width as u32, height as u32, pixels) {
            Some(img) => img,
            None => return Err("Failed to create image buffer".to_string()),
        };

        // Encode to PNG
        let mut png_bytes: Vec<u8> = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut png_bytes);
        if img.write_to(&mut cursor, image::ImageFormat::Png).is_err() {
            return Err("Failed to encode PNG".to_string());
        }

        // Return base64 encoded
        Ok(STANDARD.encode(&png_bytes))
    }
}

#[tauri::command]
#[cfg(not(windows))]
fn get_app_icon(_exe_path: String) -> Result<String, String> {
    Err("Not supported on this platform".to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_google_auth::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Initialize system
            let mut system = System::new_all();
            system.refresh_all();

            // Get app data directory
            let data_path = app.path().app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));

            app.manage(AppState {
                system: Mutex::new(system),
                data_path,
            });

            // Setup input hooks for accurate activity detection (keyboard + mouse)
            #[cfg(windows)]
            input_hooks::setup();

            // Enable autostart by default on first run
            {
                use tauri_plugin_autostart::ManagerExt;
                let manager = app.autolaunch();
                // If autostart is not enabled yet, enable it by default
                if !manager.is_enabled().unwrap_or(false) {
                    let _ = manager.enable();
                }
            }

            // System Tray setup
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Performance Guard")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_processes,
            get_system_stats,
            get_process_by_pid,
            save_app_data,
            load_app_data,
            signal_app_ready,
            show_splash_window,
            close_splash_show_main,
            get_app_icon,
            get_user_activity,
            get_global_activity,
            check_foreground,
            get_autostart_enabled,
            set_autostart_enabled
        ])
        .on_window_event(|window, event| {
            // Intercept close request on main window - hide to tray instead of closing
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
