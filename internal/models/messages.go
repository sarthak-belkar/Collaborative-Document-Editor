package models

import "encoding/json"
import "googledocsclone/internal/crdt"

type MsgType string

// VersionVector tracks the highest operation counter seen per user
type VersionVector map[string]int

const (
	MsgTypeJoin      MsgType = "join"
	MsgTypeOperation MsgType = "operation"
	MsgTypeCursor    MsgType = "cursor"
)

type OpType string

const (
	OpTypeInsert OpType = "insert"
	OpTypeDelete OpType = "delete"
	MsgTypeSyncRequest  MsgType = "sync_request"
	MsgTypeSyncResponse MsgType = "sync_response"
)

// WSMessage is the master envelope for all incoming/outgoing messages
type WSMessage struct {
	Type           MsgType        `json:"type"`
	DocumentID     string         `json:"documentId"`
	UserID         string         `json:"userId"`
	
	// Routing Metadata
	OperationID    string         `json:"operationId,omitempty"`
	SourceServerID string         `json:"sourceServerId,omitempty"`
	
	// Payload
	Operation      *Operation     `json:"operation,omitempty"`
	Cursor         *Cursor        `json:"cursor,omitempty"`
	
	// NEW: Sync Payloads
	VersionVector  VersionVector  `json:"versionVector,omitempty"`
	Operations     []Operation    `json:"operations,omitempty"`
}

type Operation struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Counter   int       `json:"counter"` // NEW: Logical sequence number per user
	Type      OpType    `json:"type"`
	Char      crdt.Char `json:"char,omitempty"`
	CharID    string    `json:"charId,omitempty"` // For deletes
	Timestamp int64     `json:"timestamp"`        // Still useful for UI/analytics, but NOT for logic
}

type Cursor struct {
	Position int `json:"position"`
}

// ParseMessage securely parses and validates the incoming bytes
func ParseMessage(data []byte) (*WSMessage, error) {
	var msg WSMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}