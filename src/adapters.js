/**
 * Adapter - Base interface for all Aether transport adapters.
 */
export class Adapter {
    /**
     * Executes a request.
     * @param {string} method - HTTP-like method (GET, POST, etc.)
     * @param {string} url - Target URL or endpoint
     * @param {any} body - Request payload
     * @param {Object} config - Internal configuration (headers, timeout, etc.)
     * @returns {Promise<any>}
     */
    async request(method, url, body, config) {
        throw new Error("Method 'request' must be implemented");
    }
}

/**
 * FetchAdapter - Native Fetch-based adapter for HTTP requests.
 */
export class FetchAdapter extends Adapter {
    async request(method, url, body, config = {}) {
        const { headers = {}, timeout, signal } = config;

        const controller = new AbortController();
        const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null;

        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                signal: signal || controller.signal,
            };

            if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(url, options);

            if (timeoutId) clearTimeout(timeoutId);

            if (!response.ok) {
                const error = new Error(`Aether: ${response.status} ${response.statusText}`);
                error.status = response.status;
                error.response = response;
                // Attempt to parse error body if JSON
                try {
                    error.data = await response.json();
                } catch (e) {
                    error.data = null;
                }
                throw error;
            }

            // Return JSON or text based on content type
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            return await response.text();

        } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error(`Aether: Request timed out after ${timeout}ms`);
            }
            throw err;
        }
    }
}

/**
 * WebSocketAdapter - Mock implementation for Tachyon Real-Time RPC.
 * This should be expanded to work with warp-socket/warp-relay.
 */
export class WebSocketAdapter extends Adapter {
    constructor({ socket } = {}) {
        super();
        this.socket = socket;
    }

    async request(method, url, body, config = {}) {
        if (!this.socket) throw new Error("Aether: WebSocketAdapter requires a socket instance");

        // Assuming warpSocket follows a request-response pattern: socket.request(payload)
        return new Promise((resolve, reject) => {
            const timeout = config.timeout || 10000;
            const timer = setTimeout(() => reject(new Error("Aether: RPC Timeout")), timeout);

            this.socket.send(JSON.stringify({
                type: 'rpc_request',
                method,
                url,
                body,
                id: Math.random().toString(36).substr(2, 9)
            }), (response) => {
                clearTimeout(timer);
                if (response.error) reject(new Error(response.error));
                else resolve(response.data);
            });

            // Note: This is an example, real warp-socket implementation might differ.
        });
    }
}
