# Aether.js
### The Universal Async Client

Aether is a modern, adapter-based async client designed for high-performance UI applications. It abstracts the transport layer (Fetch, WebSocket, RPC) while providing powerful features like automatic deduping, smart retries, and direct integration with `warp-store`.

## Features

- **Adapter-Centric**: Switch between HTTP (Fetch), WebSocket (RPC), or any custom transport without changing your business logic.
- **Automatic Deduping**: Prevents "race conditions" by ensuring only one request for the same resource is in flight at any time.
- **Smart Retries**: Built-in Exponential Backoff with Jitter. Stops automatically on 4xx client errors.
- **Warp-Store Piping**: Directly inject API responses into `warp-store` with a single call.
- **Reactive Hooks**: Native `watch()` method for easy UI integration.
- **Lightweight & Isomorphic**: Works in Node.js, Browser, and Edge runtimes.

## Installation

```bash
npm install @mirkorg/aether
```

## Usage

### Basic HTTP
```javascript
import { Aether, FetchAdapter } from "@mirkorg/aether";

const api = new Aether({
  adapter: new FetchAdapter(),
  baseURL: "https://api.example.com"
});

const user = await api.get("/users/1");
```

### Warp-Store Integration (Pipe)
Aether integrates natively with `warp-store` to manage global state reactively.

```javascript
import { Aether } from "@mirkorg/aether";
import { warpStore } from "@mirkorg/warp-store";

const api = new Aether({ baseURL: "https://api.example.com" });

// Link the store to Aether
api.setStore(warpStore);

// Executes the GET request and automatically updates the warp-store under the 'currentUser' key.
// If an identical request is already in flight, Aether automatically dedupes it.
await api.pipe("/auth/me", "currentUser");

// Now 'currentUser' is available in the store and will trigger UI updates.
console.log(warpStore.get("currentUser"));
```

### WebSocket / RPC
```javascript
import { Aether, WebSocketAdapter } from "@mirkorg/aether";

const rpc = new Aether({
  adapter: new WebSocketAdapter({ socket: mySocket })
});

// Same identical API as the HTTP client!
const user = await rpc.get("/users/1");
```

### Reactive Watch
```javascript
const { state, subscribe } = api.watch("/todos/1");

subscribe((s) => {
  console.log(s.loading, s.data, s.error);
});
```
