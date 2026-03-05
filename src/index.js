import { FetchAdapter } from './adapters.js';

/**
 * Aether - The Universal Async Client.
 * Features: Adapter-based, Deduping, Smart Retries, Warp-Store integration, Reactive Hooks.
 */
export class Aether {
    constructor({
        adapter = new FetchAdapter(),
        baseURL = '',
        headers = {},
        timeout = 30000,
        retries = 3,
        retryDelay = 1000,
        middlewares = []
    } = {}) {
        this.adapter = adapter;
        this.baseURL = baseURL;
        this.headers = headers;
        this.timeout = timeout;
        this.retries = retries;
        this.retryDelay = retryDelay;
        this.middlewares = middlewares;
        this.pending = new Map(); // For request deduping
        this.warpStore = null; // Set via setStore or if imported
    }

    /**
     * Link Aether to a warp-store instance for piping.
     * @param {Object} store - warp-store instance
     */
    setStore(store) {
        this.warpStore = store;
    }

    /**
     * Internal request method with deduping and retries.
     */
    async req(method, url, body = null, config = {}) {
        const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
        const key = `${method}:${fullUrl}:${JSON.stringify(body)}`;

        // Deduping: If a request for the same resource is pending, return it.
        if (this.pending.has(key)) {
            return this.pending.get(key);
        }

        const promise = (async () => {
            let attempt = 0;
            const maxRetries = config.retries !== undefined ? config.retries : this.retries;

            while (attempt <= maxRetries) {
                try {
                    // Combine headers and config
                    const finalConfig = {
                        timeout: config.timeout || this.timeout,
                        headers: { ...this.headers, ...config.headers },
                        ...config
                    };

                    // Run middlewares (Interceptors)
                    let ctx = { method, url: fullUrl, body, config: finalConfig };
                    for (const mw of this.middlewares) {
                        await mw(ctx);
                    }

                    // Execute request through adapter
                    return await this.adapter.request(method, fullUrl, body, finalConfig);
                } catch (err) {
                    const isLastAttempt = attempt === maxRetries;
                    const isClientError = err.status >= 400 && err.status < 500;

                    // Stop retrying if last attempt or it's a 4xx client error (except maybe 429)
                    if (isLastAttempt || (isClientError && err.status !== 429)) {
                        throw err;
                    }

                    // Exponential Backoff with Jitter
                    const delay = this._getRetryDelay(attempt);
                    console.warn(`Aether: Retrying ${fullUrl} in ${delay}ms (Attempt ${attempt + 1}/${maxRetries})`);
                    await new Promise(r => setTimeout(r, delay));
                    attempt++;
                }
            }
        })().finally(() => {
            this.pending.delete(key);
        });

        this.pending.set(key, promise);
        return promise;
    }

    /**
     * Calculates delay using Exponential Backoff + Jitter.
     */
    _getRetryDelay(attempt) {
        const base = this.retryDelay;
        const max = 10000;
        const exponential = Math.min(max, base * Math.pow(2, attempt));
        const jitter = Math.random() * 0.3 * exponential; // 30% jitter
        return exponential + jitter;
    }

    // HTTP Aliases
    get(url, config) { return this.req('GET', url, null, config); }
    post(url, body, config) { return this.req('POST', url, body, config); }
    put(url, body, config) { return this.req('PUT', url, body, config); }
    delete(url, config) { return this.req('DELETE', url, null, config); }

    /**
     * Killer Feature: Directly pipe response to warp-store.
     * @param {string} url - Request URL
     * @param {string} storeKey - Key to set in warp-store
     * @param {Object} config - Request config
     */
    async pipe(url, storeKey, config = {}) {
        const data = await this.get(url, config);
        if (this.warpStore) {
            this.warpStore.set(storeKey, data, config.ttlMs || 0);
        } else {
            console.error("Aether: Warp Store not linked. Use aether.setStore(warpStore).");
        }
        return data;
    }

    /**
     * Hook-style reactive request.
     * @param {string} url 
     * @returns {Object} { data: Ref, error: Ref, loading: Ref }
     */
    watch(url, config = {}) {
        // This is a generic implementation. 
        // In a real Vue/React environment, we'd use Refs/State.
        // For vanilla, we return an object with a callback or use an EventTarget.

        const state = {
            data: null,
            error: null,
            loading: true,
            _listeners: []
        };

        const notify = () => state._listeners.forEach(cb => cb(state));

        this.get(url, config)
            .then(res => {
                state.data = res;
                state.loading = false;
                notify();
            })
            .catch(err => {
                state.error = err;
                state.loading = false;
                notify();
            });

        return {
            state,
            subscribe: (cb) => {
                state._listeners.push(cb);
                cb(state); // Initial call
                return () => state._listeners = state._listeners.filter(l => l !== cb);
            }
        };
    }
}

// Re-export adapters
export * from './adapters.js';
