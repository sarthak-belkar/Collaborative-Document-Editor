package crdt

// Char represents a single character in the CRDT document
type Char struct {
	ID       string `bson:"id" json:"id"`             // Globally unique: "{userID}-{counter}"
	Value    string `bson:"value" json:"value"`        // The actual character/string
	Visible  bool   `bson:"visible" json:"visible"`    // False if deleted (Tombstone)
	Position []int  `bson:"position" json:"position"`  // Fractional index for absolute ordering
}

// CRDTDocument holds the full state of the document
type CRDTDocument struct {
	Chars []Char `bson:"chars" json:"chars"`
}

func NewDocument() *CRDTDocument {
	return &CRDTDocument{
		Chars: make([]Char, 0),
	}
}