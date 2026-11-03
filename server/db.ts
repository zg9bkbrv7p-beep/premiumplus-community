import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
export function openDb(path: string) {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),share_id TEXT,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),name TEXT NOT NULL,address TEXT NOT NULL,description TEXT NOT NULL,revision INTEGER NOT NULL,plan TEXT NOT NULL,image TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS project_archives(project_id TEXT PRIMARY KEY REFERENCES projects(id),archived_at TEXT,archived_by TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS project_trash(project_id TEXT PRIMARY KEY REFERENCES projects(id),deleted_at TEXT,deleted_by TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),revision INTEGER NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS shares(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),proposal_id TEXT NOT NULL REFERENCES proposals(id),hash TEXT UNIQUE NOT NULL,expires INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS agreements(id TEXT PRIMARY KEY,proposal_id TEXT UNIQUE NOT NULL REFERENCES proposals(id),name TEXT NOT NULL,accepted_at TEXT NOT NULL,snapshot TEXT NOT NULL,sha256 TEXT NOT NULL,total INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS agreement_no_update BEFORE UPDATE ON agreements BEGIN SELECT RAISE(ABORT,'Accepted agreement is immutable');END;
CREATE TRIGGER IF NOT EXISTS agreement_no_delete BEFORE DELETE ON agreements BEGIN SELECT RAISE(ABORT,'Accepted agreement is immutable');END;
CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),author TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),label TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
`);
  return db;
}
