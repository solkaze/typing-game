mod db;

use std::sync::Mutex;

use rusqlite::Connection;
use serde_json::Value;
use tauri::{Manager, State};

struct Db(Mutex<Connection>);

#[tauri::command]
fn save_session(db: State<Db>, session: Value) -> Result<i64, String> {
  let conn = db.0.lock().map_err(|e| e.to_string())?;
  db::save(&conn, &session)
}

#[tauri::command]
fn load_sessions(db: State<Db>) -> Result<Vec<Value>, String> {
  let conn = db.0.lock().map_err(|e| e.to_string())?;
  db::load(&conn)
}

#[tauri::command]
fn delete_session(db: State<Db>, id: i64) -> Result<(), String> {
  let conn = db.0.lock().map_err(|e| e.to_string())?;
  db::delete(&conn, id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      let dir = app.path().app_data_dir()?;
      std::fs::create_dir_all(&dir)?;
      app.manage(Db(Mutex::new(db::open(&dir.join("sessions.db"))?)));
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      save_session,
      load_sessions,
      delete_session
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
