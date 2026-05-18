package services

import (
	"errors"
	"collab-backend/internal/models"
	"collab-backend/internal/websocket"
)

// ApplyOperation mutates the hot-layer document state safely.
func ApplyOperation(state *websocket.RoomState, op *models.Operation) error {
	if op == nil {
		return errors.New("operation is nil")
	}

	// Convert to runes to safely handle emojis and multi-byte UTF-8 characters
	runes := []rune(state.DocumentContent)
	
	if op.Position < 0 || op.Position > len(runes) {
		return errors.New("operation position out of bounds")
	}

	switch op.Type {
	case models.OpTypeInsert:
		// Insert value at position
		insertRunes := []rune(op.Value)
		head := append([]rune{}, runes[:op.Position]...)
		tail := append(insertRunes, runes[op.Position:]...)
		state.DocumentContent = string(append(head, tail...))
		
	case models.OpTypeDelete:
		// Delete 1 character at position
		if op.Position >= len(runes) {
			return errors.New("cannot delete past end of document")
		}
		head := append([]rune{}, runes[:op.Position]...)
		tail := runes[op.Position+1:]
		state.DocumentContent = string(append(head, tail...))
		
	default:
		return errors.New("unknown operation type")
	}

	// Increment document version for ordering
	state.Version++
	op.Version = state.Version // Stamp the operation with the official server version

	return nil
}