package database

import (
	"context"
	"log"
	"time"

	"googledocsclone/internal/crdt" // NEW: Import the CRDT package
	"googledocsclone/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var Client *mongo.Client
var DocCollection *mongo.Collection

// InitDB connects to Mongo and sets up the collection
func InitDB(uri string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		log.Fatalf("MongoDB ping failed: %v", err)
	}

	Client = client
	DocCollection = client.Database("collab_db").Collection("documents")
	log.Println("Connected to MongoDB successfully")
}

// CreateDocument inserts a new blank document
func CreateDocument(ctx context.Context, title string) (*models.Document, error) {
	doc := &models.Document{
		ID:        primitive.NewObjectID(),
		Title:     title,
		// UPDATED: Initialize with an empty CRDT array instead of a string
		CRDTChars: make([]crdt.Char, 0), 
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := DocCollection.InsertOne(ctx, doc)
	return doc, err
}

// GetDocument fetches a document by its ObjectID
func GetDocument(ctx context.Context, id string) (*models.Document, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	var doc models.Document
	err = DocCollection.FindOne(ctx, bson.M{"_id": objID}).Decode(&doc)
	return &doc, err
}

// NEW: UpdateDocument overwrites the CRDT array in MongoDB for periodic snapshots
func UpdateDocument(ctx context.Context, id string, chars []crdt.Char) error {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	update := bson.M{
		"$set": bson.M{
			// Store the full CRDT array, including tombstones
			"crdt_chars": chars,
			"updated_at": time.Now(),
		},
	}

	_, err = DocCollection.UpdateOne(ctx, bson.M{"_id": objID}, update)
	return err
}