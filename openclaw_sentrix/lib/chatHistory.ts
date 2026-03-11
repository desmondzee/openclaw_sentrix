/**
 * IndexedDB-backed chat history persistence.
 *
 * Messages are stored in a `claw_chat` database, keyed by auto-incrementing
 * integer key so we can efficiently paginate in reverse chronological order.
 * History is implicitly scoped to the browser origin (each origin gets its
 * own IndexedDB namespace — no sign-in required).
 */

export interface PersistedMessage {
    /** Auto-assigned by IndexedDB (IDBValidKey). Present after read. */
    key?: number;
    id: string;
    role: "user" | "assistant";
    text: string;
    timestamp: number; // Date.now()
}

const DB_NAME = "claw_chat";
const DB_VERSION = 1;
const STORE_NAME = "messages";

/** Open (or create) the database. Cached per page lifetime. */
let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { autoIncrement: true });
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

/** Save a single message. Returns the auto-generated key. */
export async function saveMessage(
    msg: Omit<PersistedMessage, "key">
): Promise<number> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.add(msg);
        req.onsuccess = () => resolve(req.result as number);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Get the most recent `count` messages.
 * If `beforeKey` is provided, returns `count` messages with keys strictly
 * less than `beforeKey` (for pagination / infinite scroll-up).
 *
 * Returns messages in ascending order (oldest first) for display,
 * along with `hasMore` indicating if there are older messages.
 */
export async function getRecentMessages(
    count: number,
    beforeKey?: number
): Promise<{ messages: PersistedMessage[]; hasMore: boolean }> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);

        // Open a cursor going backwards (prev) from the upper bound
        const range = beforeKey != null
            ? IDBKeyRange.upperBound(beforeKey, true) // exclusive upper bound
            : undefined;

        const req = store.openCursor(range, "prev");
        const results: PersistedMessage[] = [];
        let collected = 0;
        let hasMore = false;

        req.onsuccess = () => {
            const cursor = req.result;
            if (cursor && collected < count) {
                results.push({ ...cursor.value, key: cursor.key as number });
                collected++;
                cursor.continue();
            } else {
                // If cursor still has data after collecting `count`, there are more
                hasMore = cursor != null;
                // Reverse so oldest is first (for chronological display)
                results.reverse();
                resolve({ messages: results, hasMore });
            }
        };
        req.onerror = () => reject(req.error);
    });
}

/** Delete all chat history. */
export async function clearHistory(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}
