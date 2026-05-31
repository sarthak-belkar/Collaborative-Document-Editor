package models

import (
	"time"
	"googledocsclone/internal/crdt"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Document struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title     string             `bson:"title" json:"title"`
	// Replaced Content with CRDTChars
	CRDTChars []crdt.Char        `bson:"crdt_chars" json:"crdt_chars"` 
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}