// =============================================================
//  Prism Shift — platform/web/storage.js
//  localStorage wrapper conforming to the IStorage interface.
//  Swallows errors (private mode, quota, disabled storage).
// =============================================================

/**
 * Create a storage adapter backed by localStorage.
 * Interface: { get(key) -> string|null, set(key, value) }
 */
export function createStorage() {
  // Feature-detect once
  let available = false;
  try {
    const testKey = "__ps_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    available = true;
  } catch (e) {
    available = false;
  }

  // In-memory fallback so the game still works when localStorage
  // is unavailable (e.g. iOS Safari in private mode pre-2019, or
  // a user with storage disabled). Saves are lost on reload but
  // the session works.
  const mem = Object.create(null);

  return {
    get(key) {
      if (!available) return mem[key] !== undefined ? mem[key] : null;
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return mem[key] !== undefined ? mem[key] : null;
      }
    },

    set(key, value) {
      if (!available) {
        mem[key] = String(value);
        return;
      }
      try {
        localStorage.setItem(key, String(value));
      } catch (e) {
        // Quota exceeded or storage disabled mid-session.
        // Fall back to memory so at least the session continues.
        mem[key] = String(value);
      }
    },

    remove(key) {
      if (available) {
        try { localStorage.removeItem(key); } catch (e) {}
      }
      delete mem[key];
    },

    /** True if persistence is real (not memory-only). */
    isPersistent() {
      return available;
    }
  };
}