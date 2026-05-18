package websocket

import (
	"sync"
	"collab-backend/internal/database"
	"collab-backend/internal/models"
	"context"
)

type Hub struct {
	Rooms          map[string]*Room
	mu             sync.RWMutex
	UnregisterRoom chan string
}

func NewHub() *Hub {
	return &Hub{
		Rooms:          make(map[string]*Room),
		UnregisterRoom: make(chan string),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case roomID := <-h.UnregisterRoom:
			h.mu.Lock()
			delete(h.Rooms, roomID)
			h.mu.Unlock()
		}
	}
}

// GetOrCreateRoom safely fetches an active room, or boots up a new one from MongoDB.
func (h *Hub) GetOrCreateRoom(docID string) *Room {
	h.mu.RLock()
	room, exists := h.Rooms[docID]
	h.mu.RUnlock()

	if exists {
		return room
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	
	// Double-check locking pattern
	if room, exists := h.Rooms[docID]; exists {
		return room
	}

	// Boot up room state from DB (MongoDB load-only layer)
	doc, err := database.GetDocument(context.Background(), docID)
	initialContent := ""
	if err == nil && doc != nil {
		initialContent = doc.Content
	}

	room = NewRoom(h, docID, initialContent)
	h.Rooms[docID] = room
	
	// Boot the dedicated Actor loop for this room
	go room.Run()

	return room
}

// RouteMessage directs the parsed payload to the correct Room channel
func (h *Hub) RouteMessage(docID string, msg *models.WSMessage) {
	room := h.GetOrCreateRoom(docID)

	switch msg.Type {
	case models.MsgTypeOperation:
		room.OpQueue <- msg // Goes to strict queue
	case models.MsgTypeCursor, models.MsgTypeJoin:
		room.Broadcast <- msg // Goes to direct broadcast
	}
}