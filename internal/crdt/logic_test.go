package crdt

import (
	"testing"
)

func TestCRDTOrdering(t *testing.T) {
	doc := NewDocument()

	// Simulate User 1 inserting "A" at position [10]
	InsertChar(doc, Char{ID: "u1-1", Value: "A", Position: []int{10}})
	
	// Simulate User 2 inserting "C" at position [20]
	InsertChar(doc, Char{ID: "u2-1", Value: "C", Position: []int{20}})

	// Simulate User 1 inserting "B" exactly between A and C [15]
	InsertChar(doc, Char{ID: "u1-2", Value: "B", Position: []int{15}})

	result := GetVisibleString(doc)
	if result != "ABC" {
		t.Fatalf("Expected 'ABC', got '%s'", result)
	}
}

func TestCRDTConcurrentTieBreaker(t *testing.T) {
	doc := NewDocument()
	
	// Both users try to insert at the exact same fractional position [15]
	InsertChar(doc, Char{ID: "userA-1", Value: "X", Position: []int{15}})
	InsertChar(doc, Char{ID: "userB-1", Value: "Y", Position: []int{15}})

	// Because userA < userB, X should appear before Y mathematically
	result := GetVisibleString(doc)
	if result != "XY" {
		t.Fatalf("Expected tie-breaker to yield 'XY', got '%s'", result)
	}
}