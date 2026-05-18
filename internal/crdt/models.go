package crdt

// Char represents a single character in the CRDT document
type Char struct {
	ID       string // Globally unique: "{userID}-{counter}"
	Value    string // The actual character/string
	Visible  bool   // False if deleted (Tombstone)
	Position []int  // Fractional index for absolute ordering
}

// CRDTDocument holds the full state of the document
type CRDTDocument struct {
	Chars []Char
}

func NewDocument() *CRDTDocument {
	return &CRDTDocument{
		Chars: make([]Char, 0),
	}
}