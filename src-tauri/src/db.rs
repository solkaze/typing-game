use rusqlite::{params, Connection};
use serde_json::Value;

// セッションは打鍵ログごと JSON のまま保存する。分析はフロント側で生ログから
// 計算し直すので、分析項目を増やしてもスキーマを変えずに済む。
pub fn open(path: &std::path::Path) -> rusqlite::Result<Connection> {
  let conn = Connection::open(path)?;
  init(&conn)?;
  Ok(conn)
}

fn init(conn: &Connection) -> rusqlite::Result<()> {
  conn.execute_batch(
    "CREATE TABLE IF NOT EXISTS sessions (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       started_at TEXT NOT NULL,
       data TEXT NOT NULL
     );",
  )
}

pub fn save(conn: &Connection, session: &Value) -> Result<i64, String> {
  let started_at = session
    .get("startedAt")
    .and_then(Value::as_str)
    .ok_or("session has no startedAt")?;
  conn
    .execute(
      "INSERT INTO sessions (started_at, data) VALUES (?1, ?2)",
      params![started_at, session.to_string()],
    )
    .map_err(|e| e.to_string())?;
  Ok(conn.last_insert_rowid())
}

pub fn load(conn: &Connection) -> Result<Vec<Value>, String> {
  let mut stmt = conn
    .prepare("SELECT id, data FROM sessions ORDER BY started_at, id")
    .map_err(|e| e.to_string())?;
  let rows = stmt
    .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))
    .map_err(|e| e.to_string())?;
  let mut sessions = Vec::new();
  for row in rows {
    let (id, data) = row.map_err(|e| e.to_string())?;
    let mut session: Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    session["id"] = id.into();
    sessions.push(session);
  }
  Ok(sessions)
}

pub fn delete(conn: &Connection, id: i64) -> Result<(), String> {
  conn
    .execute("DELETE FROM sessions WHERE id = ?1", params![id])
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  #[test]
  fn saves_loads_in_order_and_deletes() {
    let conn = Connection::open_in_memory().unwrap();
    init(&conn).unwrap();

    let later = save(&conn, &json!({ "startedAt": "2026-10-05T10:00:00Z", "correct": 2 })).unwrap();
    let earlier = save(&conn, &json!({ "startedAt": "2026-10-04T10:00:00Z", "correct": 1 })).unwrap();

    let loaded = load(&conn).unwrap();
    assert_eq!(loaded.len(), 2);
    assert_eq!(loaded[0]["id"], earlier);
    assert_eq!(loaded[0]["correct"], 1);
    assert_eq!(loaded[1]["id"], later);

    delete(&conn, earlier).unwrap();
    assert_eq!(load(&conn).unwrap().len(), 1);
  }

  #[test]
  fn rejects_a_session_without_start_time() {
    let conn = Connection::open_in_memory().unwrap();
    init(&conn).unwrap();
    assert!(save(&conn, &json!({ "correct": 1 })).is_err());
  }
}
