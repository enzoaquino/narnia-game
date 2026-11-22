const KEY = 'narnia-save-v1';

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Remembers which room the player reached. Silently does nothing if storage is unavailable. */
export function createSave(storage = defaultStorage()) {
  return {
    load() {
      try {
        const raw = storage?.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return Number.isInteger(data?.roomIndex) && data.roomIndex >= 0 ? { roomIndex: data.roomIndex } : null;
      } catch {
        return null;
      }
    },
    save(data) {
      try {
        storage?.setItem(KEY, JSON.stringify(data));
      } catch {
        // storage full or blocked: progress just isn't remembered
      }
    },
    clear() {
      try {
        storage?.removeItem(KEY);
      } catch {
        // ignore
      }
    },
  };
}
