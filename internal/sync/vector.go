package sync

import "googledocsclone/internal/models"

// GetMissingOperations compares a client's vector against the server's operation log.
// It returns an ordered slice of operations the client hasn't seen yet.
func GetMissingOperations(log []models.Operation, clientVector models.VersionVector) []models.Operation {
	var missing []models.Operation

	// Because the log is append-only, iterating it guarantees we return 
	// missing operations in the exact causal order they were applied.
	for _, op := range log {
		// If the client's vector doesn't have the user, it defaults to 0.
		clientHighestSeen := clientVector[op.UserID]

		// If the operation's counter is greater than what the client has seen, they need it.
		if op.Counter > clientHighestSeen {
			missing = append(missing, op)
		}
	}

	return missing
}

// UpdateVector safely advances the vector to the highest seen counter for a user
func UpdateVector(vector models.VersionVector, userID string, counter int) {
	if current, exists := vector[userID]; !exists || counter > current {
		vector[userID] = counter
	}
}