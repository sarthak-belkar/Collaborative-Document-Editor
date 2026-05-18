package websocket

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"googledocsclone/internal/crdt"
	"googledocsclone/internal/database"
	"googledocsclone/internal/models"
	redisLayer "googledocsclone/internal/redis"
	syncEngine "googledocsclone/internal/sync"

	"github.com/redis/go-redis/v9"
)

// RoomState holds the hot-layer memory state for the document
type RoomState struct {
	Document *crdt.CRDTDocument
	Version  int
	Cursors  map[string]int // UserID -> Cursor Position
}

// Room manages the routing, state, and distribution of a single document
type Room struct {
	ID         string
	State      *RoomState
	Clients    map[*Client]bool

	// Channels for local concurrency
	OpQueue    chan *models.WSMessage // Strictly ordered operations
	Broadcast  chan *models.WSMessage // Ephemeral broadcasts (cursors)
	Register   chan *Client
	Unregister chan *Client
	Hub        *Hub

	// Distributed state
	PubSub       *redis.PubSub
	ProcessedOps map[string]bool // Deduplication map for loop prevention
	opMutex      sync.RWMutex    // Protects ProcessedOps

	isDirty bool // Tracks if there are unsaved DB changes

	// NEW: State Tracking for Offline Sync
	OperationLog  []models.Operation
	VersionVector models.VersionVector
}

// NewRoom initializes a room, boots up its Redis listener, and prepares it for clients
func NewRoom(hub *Hub, docID string, initialContent *crdt.CRDTDocument) *Room {
	r := &Room{
		ID: docID,
		State: &RoomState{
			Document: initialContent,
			Version:  0,
			Cursors:  make(map[string]int),
		},
		Clients:      make(map[*Client]bool),
		OpQueue:      make(chan *models.WSMessage, 256),
		Broadcast:    make(chan *models.WSMessage, 256),
		Register:     make(chan *Client),
		Unregister:   make(chan *Client),
		Hub:          hub,
		ProcessedOps: make(map[string]bool),
	}

	// Subscribe to this specific document's Redis channel
	r.PubSub = redisLayer.Client.Subscribe(context.Background(), "doc:"+docID)
	
	// Boot the background listener for remote Redis operations
	go r.listenToRedis()

	return r
}

// Run is the main Actor loop. It ensures only ONE goroutine ever mutates RoomState.
func (r *Room) Run() {
	// Snapshot timer to save to MongoDB without blocking user typing
	saveTicker := time.NewTicker(30 * time.Second)
	defer saveTicker.Stop()

	for {
		select {
		case client := <-r.Register:
			r.Clients[client] = true
			log.Printf("Client %s joined room %s", client.ID, r.ID)

		case client := <-r.Unregister:
			if _, ok := r.Clients[client]; ok {
				delete(r.Clients, client)
				delete(r.State.Cursors, client.ID) // Clear cursor
				close(client.Send)

				// Shutdown sequence when the room empties
				if len(r.Clients) == 0 {
					if r.isDirty {
						r.saveSnapshot()
					}
					r.PubSub.Close() // VERY IMPORTANT: Prevent Redis connection leaks
					r.Hub.UnregisterRoom <- r.ID
					return // Exit the goroutine cleanly
				}
			}

		case msg := <-r.OpQueue:
			// 1. Process Sync Requests
			if msg.Type == models.MsgTypeSyncRequest {
				r.handleSyncRequest(msg)
				continue
			}

			// 2. Standard Operation Processing
			if msg.Type == models.MsgTypeOperation && msg.Operation != nil {
				// Deduplication
				if r.hasProcessed(msg.OperationID) {
					continue
				}
				r.markProcessed(msg.OperationID)

				// Apply to CRDT
				ApplyCRDTOperation(r.State, msg.Operation)
				
				// NEW: Update State Vectors and Append to Log
				syncEngine.UpdateVector(r.VersionVector, msg.Operation.UserID, msg.Operation.Counter)
				r.OperationLog = append(r.OperationLog, *msg.Operation)
				
				r.isDirty = true

				// Broadcast locally and to Redis
				r.broadcastToClients(msg, false)
				if msg.SourceServerID == redisLayer.ServerID {
					r.PublishOperation(msg)
				}
			}

		case msg := <-r.Broadcast:
			// Handle ephemeral cursor state
			if msg.Type == models.MsgTypeCursor && msg.Cursor != nil {
				r.State.Cursors[msg.UserID] = msg.Cursor.Position
			}
			r.broadcastToClients(msg, true) // skipSender = true

		case <-saveTicker.C:
			// Periodic async database snapshot
			if r.isDirty {
				r.saveSnapshot()
				r.isDirty = false
			}
		}
	}
}

// listenToRedis runs in the background and funnels remote operations into the local strict queue
func (r *Room) listenToRedis() {
	ch := r.PubSub.Channel()
	for msg := range ch {
		var wsMsg models.WSMessage
		if err := json.Unmarshal([]byte(msg.Payload), &wsMsg); err != nil {
			log.Printf("Malformed message from Redis in room %s", r.ID)
			continue
		}

		// Push the remote operation into our local strict queue
		r.OpQueue <- &wsMsg
	}
}

// PublishOperation sends local changes out to the Redis cluster
func (r *Room) PublishOperation(msg *models.WSMessage) {
	payload, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal redis payload: %v", err)
		return
	}

	// Fire and forget in a background goroutine to prevent blocking the Actor loop
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		
		err := redisLayer.Client.Publish(ctx, "doc:"+r.ID, payload).Err()
		if err != nil {
			log.Printf("Redis publish failed for doc %s: %v", r.ID, err)
		}
	}()
}

// saveSnapshot makes a lock-free copy of the CRDT array and saves it to MongoDB
func (r *Room) saveSnapshot() {
	// Deep copy the array to avoid memory corruption while DB takes its time
	charsCopy := make([]crdt.Char, len(r.State.Document.Chars))
	copy(charsCopy, r.State.Document.Chars)

	// Fire and forget the database save
	go func(docID string, chars []crdt.Char) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := database.UpdateDocument(ctx, docID, chars)
		if err != nil {
			log.Printf("Failed to save snapshot for room %s: %v", docID, err)
		}
	}(r.ID, charsCopy)
}

// broadcastToClients pushes the message down the WebSocket connection for local clients
func (r *Room) broadcastToClients(msg *models.WSMessage, skipSender bool) {
	for client := range r.Clients {
		if skipSender && client.ID == msg.UserID {
			continue
		}
		select {
		case client.Send <- msg:
		default:
			// Client channel is stuck, force disconnect
			close(client.Send)
			delete(r.Clients, client)
		}
	}
}

// ApplyCRDTOperation is a helper to route the operation to the correct CRDT logic
func ApplyCRDTOperation(state *RoomState, op *models.Operation) {
	if op == nil {
		return
	}
	if op.Type == models.OpTypeInsert {
		crdt.InsertChar(state.Document, op.Char)
	} else if op.Type == models.OpTypeDelete {
		crdt.DeleteChar(state.Document, op.CharID)
	}
	state.Version++
}

// --- Thread-Safe Deduplication Helpers ---

func (r *Room) hasProcessed(opID string) bool {
	if opID == "" {
		return false
	}
	r.opMutex.RLock()
	defer r.opMutex.RUnlock()
	return r.ProcessedOps[opID]
}

func (r *Room) markProcessed(opID string) {
	if opID == "" {
		return
	}
	r.opMutex.Lock()
	defer r.opMutex.Unlock()
	r.ProcessedOps[opID] = true
}

// handleSyncRequest processes a reconnecting client's state vector
func (r *Room) handleSyncRequest(msg *models.WSMessage) {
	// 1. Calculate what the client missed
	missingOps := syncEngine.GetMissingOperations(r.OperationLog, msg.VersionVector)

	// 2. Construct the response payload
	response := &models.WSMessage{
		Type:       models.MsgTypeSyncResponse,
		DocumentID: r.ID,
		Operations: missingOps,
	}

	// 3. Find the specific client and send the catch-up state directly to them
	for client := range r.Clients {
		if client.ID == msg.UserID {
			client.Send <- response
			break
		}
	}
}