package websocket

import (
	"log"
	"net/http"
	"time"

	"googledocsclone/internal/models"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins for dev. In prod, check r.Header.Get("Origin")
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Client struct {
	ID         string
	Hub        *Hub
	Conn       *websocket.Conn
	DocumentID string
	Send       chan *models.WSMessage // Buffered channel for outbound messages
	Room       *Room
}

// ReadPump listens for incoming WS messages from this specific client
func (c *Client) ReadPump() {
	defer func() {
		c.Room.Unregister <- c
		c.Conn.Close()
	}()
	for {
		_, rawMsg, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		msg, err := models.ParseMessage(rawMsg)
		if err != nil {
			// Drop malformed messages safely
			continue
		}

		// Enforce server-side trust
		msg.DocumentID = c.Room.ID
		msg.UserID = c.ID
		
		c.Room.Hub.RouteMessage(c.Room.ID, msg)
	}
}

// WritePump pushes queued messages from the Send channel to the WebSocket
func (c *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second) // Ping ticker
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.Conn.WriteJSON(msg)
		case <-ticker.C:
			c.Conn.WriteMessage(websocket.PingMessage, nil)
		}
	}
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request, documentID string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	room := hub.GetOrCreateRoom(documentID)
	client := &Client{
		ID:         uuid.New().String(),
		Hub:        hub,
		Conn:       conn,
		DocumentID: documentID,
		Send:       make(chan *models.WSMessage, 256),
		Room:       room,
	}

	client.Room.Register <- client

	// Run pumps in separate goroutines
	go client.WritePump()
	go client.ReadPump()
}