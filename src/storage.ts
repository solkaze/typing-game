import { invoke, isTauri } from '@tauri-apps/api/core'
import type { Session } from './types'

// ブラウザ単体 (npm run dev) でも動くよう、Tauri 外では localStorage に保存する
const LOCAL_KEY = 'typing-game.sessions'

function readLocal(): Session[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeLocal(sessions: Session[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(sessions))
}

export async function saveSession(session: Session): Promise<number> {
  if (isTauri()) return invoke<number>('save_session', { session })
  const sessions = readLocal()
  const id = sessions.reduce((max, s) => Math.max(max, s.id ?? 0), 0) + 1
  writeLocal([...sessions, { ...session, id }])
  return id
}

// 古い順
export async function loadSessions(): Promise<Session[]> {
  if (isTauri()) return invoke<Session[]>('load_sessions')
  return readLocal()
}

export async function deleteSession(id: number): Promise<void> {
  if (isTauri()) return invoke('delete_session', { id })
  writeLocal(readLocal().filter((s) => s.id !== id))
}
