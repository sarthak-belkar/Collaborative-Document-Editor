package crdt

import (
	"strings"
)

// Compare determines the exact ordering of two characters.
// Returns -1 if c1 < c2, 1 if c1 > c2, and 0 if equal.
func Compare(pos1, pos2 []int, id1, id2 string) int {
	maxLen := len(pos1)
	if len(pos2) > maxLen {
		maxLen = len(pos2)
	}

	for i := 0; i < maxLen; i++ {
		v1 := 0
		if i < len(pos1) {
			v1 = pos1[i]
		}
		v2 := 0
		if i < len(pos2) {
			v2 = pos2[i]
		}

		if v1 < v2 {
			return -1
		} else if v1 > v2 {
			return 1
		}
	}

	// If positions are identical, tie-break using the globally unique Site/User ID
	if id1 < id2 {
		return -1
	} else if id1 > id2 {
		return 1
	}
	return 0
}

// InsertChar adds a character into the sorted array.
func InsertChar(doc *CRDTDocument, newChar Char) {
	// Find the correct insertion index via linear scan (can be optimized to binary search)
	insertIdx := 0
	for i, existing := range doc.Chars {
		comp := Compare(newChar.Position, existing.Position, newChar.ID, existing.ID)
		if comp == 0 {
			return // Idempotent: Character already exists, do nothing
		}
		if comp == -1 {
			break // We found the spot where newChar is strictly less than existing
		}
		insertIdx = i + 1
	}

	// Insert into slice
	if insertIdx == len(doc.Chars) {
		doc.Chars = append(doc.Chars, newChar)
	} else {
		doc.Chars = append(doc.Chars[:insertIdx+1], doc.Chars[insertIdx:]...)
		doc.Chars[insertIdx] = newChar
	}
}

// DeleteChar marks a character as deleted (Tombstone).
// CRDT Rule: We NEVER remove data from memory, we only hide it.
func DeleteChar(doc *CRDTDocument, charID string) {
	for i := range doc.Chars {
		if doc.Chars[i].ID == charID {
			doc.Chars[i].Visible = false
			return
		}
	}
	// Note: In a production system, if a delete arrives BEFORE the insert,
	// we would store the charID in a "pending deletes" list.
}

// GetVisibleString reconstructs the document for the client/DB snapshot.
func GetVisibleString(doc *CRDTDocument) string {
	var builder strings.Builder
	for _, char := range doc.Chars {
		if char.Visible {
			builder.WriteString(char.Value)
		}
	}
	return builder.String()
}