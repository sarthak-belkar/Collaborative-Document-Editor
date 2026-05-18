package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"collab-backend/internal/database"
	"collab-backend/internal/websocket"
)

func main() {
	// 1. Setup DB
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}
	database.InitDB(mongoURI)

	// 2. Setup WebSocket Hub
	hub := websocket.NewHub()
	go hub.Run()

	// 3. Setup Routes (Go 1.22+ syntax)
	mux := http.NewServeMux()

	// REST Endpoints
	mux.HandleFunc("POST /documents", handleCreateDocument)
	mux.HandleFunc("GET /documents/{id}", handleGetDocument)

	// WebSocket Endpoint
	mux.HandleFunc("GET /ws/{id}", func(w http.ResponseWriter, r *http.Request) {
		docID := r.PathValue("id")
		websocket.ServeWS(hub, w, r, docID)
	})

	// Wrap with logging middleware
	handler := loggingMiddleware(mux)

	srv := &http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	// 4. Start Server with Graceful Shutdown
	go func() {
		log.Println("Server starting on port :8080...")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Listen error: %s\n", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	// Clean up Mongo connection
	if err := database.Client.Disconnect(ctx); err != nil {
		log.Fatal("Mongo disconnect error:", err)
	}
	
	log.Println("Server exiting")
}

// --- HTTP Handlers ---

func handleCreateDocument(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	doc, err := database.CreateDocument(r.Context(), req.Title)
	if err != nil {
		http.Error(w, "Failed to create document", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

func handleGetDocument(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	doc, err := database.GetDocument(r.Context(), id)
	if err != nil {
		http.Error(w, "Document not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

// --- Middleware ---

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
	})
}