/**
 * SQLite Database Manager
 *
 * Uses sql.js (SQLite compiled to WebAssembly) in the browser.
 * Persists the database to IndexedDB for long-term storage with
 * essentially unlimited space (hundreds of MB+, vs ~5MB localStorage limit).
 *
 * The database is:
 *  - Loaded from IndexedDB on first access
 *  - Auto-saved to IndexedDB 1s after the last write (debounced)
 *  - Also saved on page unload via `beforeunload`
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

const DB_KEY = 'helpboard_sqlite';
const DB_VERSION = 1;
const DB_STORE = 'database';

// ─── Private State ───────────────────────────────────────────────────────────

let db: SqlJsDatabase | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let initPromise: Promise<SqlJsDatabase> | null = null;

// ─── IndexedDB helpers ───────────────────────────────────────────────────────

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HelpboardSQLite', DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) {
        request.result.createObjectStore(DB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadFromIDB(): Promise<Uint8Array | null> {
  try {
    const idb = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(DB_KEY);
      req.onsuccess = () => {
        resolve(req.result?.data ?? null);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => idb.close();
    });
  } catch {
    return null;
  }
}

async function saveToIDB(data: Uint8Array): Promise<void> {
  try {
    const idb = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put({ id: DB_KEY, data });
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[DB] Failed to persist to IndexedDB:', err);
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

/**
 * Persist the current in-memory database to IndexedDB.
 * Call this to ensure data is durably stored.
 */
export async function flush(): Promise<void> {
  if (persistTimer) clearTimeout(persistTimer);
  if (!db) return;
  try {
    const data = db.export();
    await saveToIDB(data);
  } catch (err) {
    console.error('[DB] Persist failed:', err);
  }
}

/** Debounced save — waits 300ms after the last write before persisting. */
function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    // Fire-and-forget: in-memory SQLite has the data, persist to IDB
    flush().catch(err => console.error('[DB] Scheduled persist failed:', err));
  }, 300);
}

// Save on page unload – browser typically completes pending IndexedDB transactions
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Start the persist synchronously; browser will usually complete the IDB tx
    flush();
  });
}

// ─── Initialisation ──────────────────────────────────────────────────────────

/**
 * Initialise (or return) the singleton SQLite database.
 * Safe to call multiple times — returns the same instance.
 */
export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `/sql-wasm.wasm`,
    });

    // Try restoring a previously saved database from IndexedDB
    const saved = await loadFromIDB();
    if (saved && saved.byteLength > 0) {
      db = new SQL.Database(saved);
    } else {
      db = new SQL.Database();
    }

    // Create schema
    db.run(`
      CREATE TABLE IF NOT EXISTS logs (
        id            TEXT PRIMARY KEY,
        log_type      TEXT NOT NULL,
        category      TEXT NOT NULL DEFAULT '',
        related_id    TEXT NOT NULL DEFAULT '',
        filename      TEXT NOT NULL DEFAULT '',
        data          TEXT NOT NULL DEFAULT '{}',
        image_data    TEXT,
        created_at    TEXT NOT NULL
      )
    `);

    db.run('CREATE INDEX IF NOT EXISTS idx_logs_type     ON logs(log_type)');
    db.run('CREATE INDEX IF NOT EXISTS idx_logs_category  ON logs(category)');
    db.run('CREATE INDEX IF NOT EXISTS idx_logs_related   ON logs(related_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_logs_created   ON logs(created_at DESC)');

    // Persist the fresh schema if it was a new DB
    if (!saved) {
      await flush();
    }

    return db!;
  })();

  return initPromise;
}

// ─── Public CRUD ─────────────────────────────────────────────────────────────

export interface LogRow {
  id: string;
  log_type: string;
  category: string;
  related_id: string;
  filename: string;
  data: Record<string, unknown>;
  image_data: string | null;
  created_at: string;
}

/** Insert a single log entry. */
export async function insertLog(row: Omit<LogRow, 'created_at'> & { created_at?: string }): Promise<void> {
  const d = await getDatabase();
  const stmt = d.prepare(`
    INSERT INTO logs (id, log_type, category, related_id, filename, data, image_data, created_at)
    VALUES ($id, $type, $cat, $rid, $file, $data, $img, $ts)
  `);
  stmt.bind({
    $id: row.id,
    $type: row.log_type,
    $cat: row.category,
    $rid: row.related_id,
    $file: row.filename,
    $data: typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
    $img: row.image_data ?? null,
    $ts: row.created_at ?? new Date().toISOString(),
  });
  stmt.step();
  stmt.free();
  schedulePersist();
}

/** Query logs with optional filters. Returns rows ordered by created_at DESC. */
export async function queryLogs(opts?: {
  logType?: string;
  category?: string;
  relatedId?: string;
  limit?: number;
}): Promise<LogRow[]> {
  const d = await getDatabase();
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (opts?.logType) {
    conditions.push('log_type = $type');
    params.$type = opts.logType;
  }
  if (opts?.category) {
    conditions.push('category = $cat');
    params.$cat = opts.category;
  }
  if (opts?.relatedId) {
    conditions.push('related_id = $rid');
    params.$rid = opts.relatedId;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = opts?.limit ? `LIMIT ${opts.limit}` : '';
  const sql = `SELECT * FROM logs ${where} ORDER BY created_at DESC ${limitClause}`;

  const results: LogRow[] = [];
  const stmt = d.prepare(sql);
  if (Object.keys(params).length > 0) {
    stmt.bind(params);
  }
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    results.push({
      id: row.id,
      log_type: row.log_type,
      category: row.category,
      related_id: row.related_id,
      filename: row.filename,
      data: safeParseJSON(row.data),
      image_data: row.image_data ?? null,
      created_at: row.created_at,
    });
  }
  stmt.free();
  return results;
}

/** Get the total number of log entries. */
export async function countLogs(): Promise<number> {
  const d = await getDatabase();
  const stmt = d.prepare('SELECT COUNT(*) AS cnt FROM logs');
  stmt.step();
  const row = stmt.getAsObject() as { cnt: number };
  stmt.free();
  return row.cnt;
}

/** Get estimated database size in KB. */
export async function getDbSizeKB(): Promise<number> {
  const d = await getDatabase();
  const exported = d.export();
  return Math.round(exported.byteLength / 1024);
}

/** Clear all logs. */
export async function clearAllLogs(): Promise<void> {
  const d = await getDatabase();
  d.run('DELETE FROM logs');
  schedulePersist();
}

/** Export the raw database bytes (for backup/download). */
export async function exportDb(): Promise<Uint8Array> {
  const d = await getDatabase();
  return d.export();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeParseJSON(value: string): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { raw: value };
  }
}
