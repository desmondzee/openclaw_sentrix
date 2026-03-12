/**
 * IndexedDB-backed investigation report persistence.
 *
 * Reports are stored in a `claw_reports` database, keyed by investigation_id.
 * Each report is merged with existing data (upsert) to handle updates.
 * History is implicitly scoped to the browser origin.
 */

export interface InvestigationReport {
  /** Investigation ID from police DB */
  investigation_id: string;
  /** Flag ID that triggered the investigation */
  flag_id: string;
  /** Target agent ID (parsed from source_file) */
  target_agent_id?: string;
  /** Source log file */
  source_file?: string;
  /** ISO timestamp when investigation concluded */
  concluded_at: string;
  /** Whether this report has been viewed by the user */
  viewed?: boolean;
  /** Case file data from police DB */
  case_file: {
    crime_classification?: string;
    severity_score?: string;
    confidence?: number;
    case_facts?: string;
    relevant_log_ids?: string[];
    verdict_summary?: string;
  };
}

const DB_NAME = "claw_reports";
const DB_VERSION = 1;
const STORE_NAME = "reports";

/** Open (or create) the database. Cached per page lifetime. */
let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Use investigation_id as the key
        const store = db.createObjectStore(STORE_NAME, { keyPath: "investigation_id" });
        // Create index for concluded_at for efficient sorting
        store.createIndex("concluded_at", "concluded_at", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      _dbPromise = null;
      reject(req.error);
    };
  });
  return _dbPromise;
}

/** Save or update a single report. */
export async function saveReport(
  report: InvestigationReport
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    
    // Check if report already exists
    const getReq = store.get(report.investigation_id);
    getReq.onsuccess = () => {
      const existing = getReq.result as InvestigationReport | undefined;
      const toSave: InvestigationReport = existing
        ? { ...existing, ...report, viewed: existing.viewed }
        : { ...report, viewed: false };
      
      const putReq = store.put(toSave);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/** Save multiple reports (batch upsert). */
export async function saveReports(
  reports: InvestigationReport[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    
    let completed = 0;
    let failed = false;
    
    if (reports.length === 0) {
      resolve();
      return;
    }
    
    const checkComplete = () => {
      completed++;
      if (completed === reports.length && !failed) {
        resolve();
      }
    };
    
    for (const report of reports) {
      const getReq = store.get(report.investigation_id);
      getReq.onsuccess = () => {
        const existing = getReq.result as InvestigationReport | undefined;
        const toSave: InvestigationReport = existing
          ? { ...existing, ...report, viewed: existing.viewed }
          : { ...report, viewed: false };
        
        const putReq = store.put(toSave);
        putReq.onsuccess = checkComplete;
        putReq.onerror = () => {
          if (!failed) {
            failed = true;
            reject(putReq.error);
          }
        };
      };
      getReq.onerror = () => {
        if (!failed) {
          failed = true;
          reject(getReq.error);
        }
      };
    }
  });
}

/** Get all reports sorted by concluded_at (newest first). */
export async function getAllReports(): Promise<InvestigationReport[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("concluded_at");
    
    const req = index.openCursor(null, "prev");
    const results: InvestigationReport[] = [];
    
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value as InvestigationReport);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Get a single report by ID. */
export async function getReport(
  investigationId: string
): Promise<InvestigationReport | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(investigationId);
    req.onsuccess = () => resolve((req.result as InvestigationReport) || null);
    req.onerror = () => reject(req.error);
  });
}

/** Mark a report as viewed. */
export async function markReportViewed(
  investigationId: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(investigationId);
    req.onsuccess = () => {
      const existing = req.result as InvestigationReport | undefined;
      if (existing) {
        existing.viewed = true;
        const putReq = store.put(existing);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Count unviewed reports. */
export async function countUnviewedReports(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    let count = 0;
    
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const report = cursor.value as InvestigationReport;
        if (!report.viewed) count++;
        cursor.continue();
      } else {
        resolve(count);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Delete all reports. */
export async function clearReports(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
