/**
 * In-memory TTL キャッシュ
 * - Cloud Functions / App Engine インスタンスが warm な間は再利用される
 * - User / Area マスタの読み込みコストを大幅削減 → AppSheet 同期前のシート Read 削減
 *
 * Cloud Functions Gen2 では複数インスタンスがあるためインスタンスごとに独立。
 * 強整合性が必要な場合は Memorystore (Redis) に置換。
 */
class TTLCache {
  constructor(defaultTtlMs = 60_000) {
    this.defaultTtlMs = defaultTtlMs;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  /**
   * miss 時のみ loader を実行する get-or-set
   */
  async getOrLoad(key, loader, ttlMs) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await loader();
    this.set(key, value, ttlMs);
    return value;
  }

  invalidate(key) {
    if (key === undefined) this.store.clear();
    else this.store.delete(key);
  }
}

module.exports = { TTLCache };
