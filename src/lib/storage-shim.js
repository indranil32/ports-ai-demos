// Stand-in for the Claude.ai artifact `window.storage` API, backed by localStorage.
// The artifact API distinguishes "shared" vs "personal" keys; outside Claude.ai both
// live in this browser's localStorage, namespaced so they don't collide.
const PREFIX = 'adports-demos:';

function keyFor(key, shared) {
  return `${PREFIX}${shared ? 'shared' : 'personal'}:${key}`;
}

if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    async get(key, shared = false) {
      const value = localStorage.getItem(keyFor(key, shared));
      return value === null ? null : { key, value, shared };
    },
    async set(key, value, shared = false) {
      localStorage.setItem(keyFor(key, shared), value);
      return { key, value, shared };
    },
    async delete(key, shared = false) {
      localStorage.removeItem(keyFor(key, shared));
      return { key, deleted: true, shared };
    },
    async list(prefix = '', shared = false) {
      const base = keyFor(prefix, shared);
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(base)) keys.push(k.slice(keyFor('', shared).length));
      }
      return { keys, prefix, shared };
    },
  };
}
