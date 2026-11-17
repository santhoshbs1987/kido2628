import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { runMigrations } from './migrations';

let dbInstance: Database.Database | null = null;

export function getDatabasePath(): string {
  // Use userData directory or fallback to current directory
  const userDataDir = app ? app.getPath('userData') : path.join(process.cwd(), '.data');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'kido2628.sqlite');
}

export function initDatabase(dbPath?: string): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const resolvedPath = dbPath || getDatabasePath();
  const dbDir = path.dirname(resolvedPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(resolvedPath);

  // Performance and Integrity pragmas
  db.pragma('foreign_keys = ON;');
  db.pragma('journal_mode = WAL;');
  db.pragma('synchronous = NORMAL;');
  db.pragma('temp_store = MEMORY;');

  // Run migrations
  runMigrations(db);

  dbInstance = db;
  return dbInstance;
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
