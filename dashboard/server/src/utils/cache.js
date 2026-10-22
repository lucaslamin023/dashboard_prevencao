// Cache simples em memória com TTL (Time-To-Live)
const store = new Map();

export const cache = {
  get(key) {
    const item = store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      store.delete(key);
      return null;
    }
    return item.value;
  },

  set(key, value, ttlSeconds = 300) {
    store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  has(key) {
    return this.get(key) !== null;
  },

  del(key) {
    store.delete(key);
  },

  clear() {
    store.clear();
  },

  // Gera chave de cache consistente a partir de prefixo e query params
  generateKey(prefix, query = {}) {
    const sortedParams = Object.keys(query)
      .sort()
      .filter((k) => query[k] !== undefined && query[k] !== null && query[k] !== '')
      .map((k) => `${k}=${encodeURIComponent(query[k])}`)
      .join('&');
    return `${prefix}:${sortedParams}`;
  },
};

export default cache;
