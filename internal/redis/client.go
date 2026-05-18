package redis

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

var Client *redis.Client
var ServerID string

// InitRedis connects to the Redis cluster and sets the unique ServerID
func InitRedis(uri string) {
	ServerID = "server-" + uuid.New().String()
	
	Client = redis.NewClient(&redis.Options{
		Addr:     uri,
		Password: "", // Set in production
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := Client.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	log.Printf("Connected to Redis successfully. Server ID: %s", ServerID)
}