# Real-Time Collaborative Editor Backend

A highly concurrent, horizontally scalable, lock-free real-time backend for a collaborative document editor (similar to Google Docs). Built entirely in Go, this system utilizes Conflict-Free Replicated Data Types (CRDTs), the Actor concurrency model, Redis Pub/Sub for stateless scaling, and Version Vectors for seamless offline synchronization.

## Features

* **Mathematical Conflict Resolution (CRDT):** Uses Fractional Indexing (LSEQ/Logoot family) to ensure absolute eventual consistency without requiring a centralized sequencing server. Concurrent edits never overwrite each other.
* **Lock-Free Concurrency:** Implements the Actor Pattern. Each document runs as a dedicated goroutine (`Room`), communicating strictly through ordered Go channels (`OpQueue`). Zero `sync.Mutex` contention on document state.
* **Horizontal Scalability:** Fully stateless backend instances. Utilizes **Redis Pub/Sub** to instantly route document operations across multiple servers. Includes built-in loop prevention and message deduplication.
* **Offline Sync:** Implements **Version Vectors** (Logical Clocks/State Vectors). If a client loses internet, they can continue editing locally. Upon reconnection, the server computes the exact missing operations and perfectly merges the offline work.
* **Asynchronous Persistence:** Hot state is kept in memory for zero-latency typing. A background goroutine periodically snapshots the CRDT array to **MongoDB** without blocking the WebSocket event loop.
* **Cursor Tracking:** Ephemeral real-time broadcasting of user cursor positions across the cluster.

## Tech Stack

* **Language:** Go (Golang) 1.22+
* **Real-Time Transport:** WebSockets (`gorilla/websocket`)
* **State Distribution:** Redis (`go-redis/v9`)
* **Persistence:** MongoDB (`go.mongodb.org/mongo-driver`)
* **Routing:** Go Standard Library (`net/http` ServeMux)

## Project Structure

```text
/collab-backend
├── cmd/
│   ├── server/           # Main application entry point
│   │   └── main.go
│   └── tester/           # Go-based E2E WebSocket test client
│       └── main.go
├── internal/
│   ├── crdt/             # Mathematical CRDT logic (Fractional Indexing)
│   ├── database/         # MongoDB connection and CRUD wrappers
│   ├── models/           # Shared structs (WSMessage, Operation, VersionVector)
│   ├── redis/            # Redis Pub/Sub initialization
│   ├── sync/             # Offline sync algorithm (Version Vector diffing)
│   └── websocket/        # Real-time engine (Hub, Room, Client, Event Loop)
├── .env                  # Environment variables (Mongo URI, Redis URI, Port)
├── go.mod
└── go.sum

```

## Getting Started

### Prerequisites

* Go 1.22 or higher
* Docker (for running local Redis and MongoDB)

### 1. Boot Infrastructure

Start MongoDB and Redis locally using Docker:

```bash
docker run -p 27017:27017 -d mongo:6.0-jammy
docker run -p 6379:6379 -d redis:latest

```

### 2. Install Dependencies

```bash
go mod tidy

```

### 3. Run the Server(s)

To test horizontal scaling, you can run multiple instances of the server on different ports.

**Terminal 1 (Server A):**

```bash
PORT=8080 go run cmd/server/main.go

```

**Terminal 2 (Server B):**

```bash
PORT=8081 go run cmd/server/main.go

```

## 🧪 Testing the Distributed Engine

Because this system relies on complex mathematical position generation (CRDTs), standard REST testing tools are insufficient. Use the included Go test client to simulate real users.

**Terminal 3 (Simulate User on Server A):**

```bash
# Connects to localhost:8080 by default, sends a Sync Request, and types a character
go run cmd/tester/main.go

```

You can point the tester at different ports to verify that Redis Pub/Sub successfully routes operations from a user on Server A to a user on Server B.

##  Architecture Deep Dive

### 1. The Room (Actor Pattern)

Instead of processing all WebSocket messages in a global hub, messages are routed to a specific `Room`. The `Room` is a single goroutine that pulls from an `OpQueue` channel. Because only one thread ever touches the `CRDTDocument`, data races are mathematically impossible.

### 2. Fractional Indexing (CRDT)

Characters are not stored at integer indices (e.g., `0, 1, 2`). They are stored with mathematically infinitely divisible position arrays (e.g., `[1, 5]`).

* To insert between `[1]` and `[2]`, the system generates `[1, 5]`.
* If two users generate `[1, 5]` simultaneously, the system deterministically tie-breaks using their globally unique User IDs.

### 3. Loop Prevention

When Server A publishes an edit to Redis `doc:123`, Server B receives it and broadcasts it to its users. To prevent Server B from bouncing that message *back* to Redis, every message is stamped with a `SourceServerID`. Servers only publish messages originating from their own WebSockets.