-- Drive V1 backend
-- Org scoped folders, notes, files, templates

CREATE TABLE IF NOT EXISTS drive_folders (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  parent_id TEXT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_drive_folders_org_parent ON drive_folders(org_id, parent_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS drive_notes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  parent_id TEXT,
  title TEXT,
  content TEXT,
  tags TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_drive_notes_org_parent ON drive_notes(org_id, parent_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS drive_files (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  parent_id TEXT,
  name TEXT,
  mime TEXT,
  size INTEGER,
  storage_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_drive_files_org_parent ON drive_files(org_id, parent_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drive_files_storage_key ON drive_files(storage_key);

CREATE TABLE IF NOT EXISTS drive_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT,
  title TEXT,
  content TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_drive_templates_org_updated ON drive_templates(org_id, updated_at DESC);
