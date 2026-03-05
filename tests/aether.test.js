import { Aether } from '../src/index.js';

// Mock global fetch for testing
let callCount = 0;
globalThis.fetch = async (url, options) => {
    callCount++;
    console.log(`[Fetch Mock] Request to: ${url} (${options.method})`);

    // Simulate latency
    await new Promise(r => setTimeout(r, 100));

    if (url.includes('/error')) {
        return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ message: 'Fail' })
        };
    }

    return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ id: 1, title: 'Test Todo' })
    };
};

const api = new Aether({ baseURL: 'https://jsonplaceholder.typicode.com' });

async function runTests() {
    console.log("--- Starting Aether Tests ---");

    // 1. Deduping Test
    console.log("\n1. Testing Deduping...");
    callCount = 0;
    const p1 = api.get('/todos/1');
    const p2 = api.get('/todos/1');
    const p3 = api.get('/todos/1');

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    console.log(`Results received. Total actual fetch calls: ${callCount}`);
    if (callCount === 1) console.log("✅ Deduping works!");
    else console.error("❌ Deduping failed!");

    // 2. Retry Test
    console.log("\n2. Testing Smart Retries...");
    callCount = 0;
    try {
        await api.get('/error', { retries: 2 });
    } catch (e) {
        console.log(`Request failed after retries. Total actual fetch calls: ${callCount}`);
        if (callCount === 3) console.log("✅ Retries work (1 try + 2 retries)!");
        else console.error(`❌ Retries failed! Count: ${callCount}`);
    }

    // 3. Watch Test
    console.log("\n3. Testing Watch...");
    const { state, subscribe } = api.watch('/todos/2');
    subscribe((s) => {
        console.log(`Watch State: loading=${s.loading}, data=${s.data ? JSON.stringify(s.data) : 'null'}`);
    });

    // Wait for watch to finish
    await new Promise(r => setTimeout(r, 500));
}

runTests().catch(console.error);
