package crdt

import "math/rand"

const Base = 100 // The "gap" size available at each depth level

// GeneratePosition creates a new fractional index strictly between prev and next.
func GeneratePosition(prev []int, next []int) []int {
	newPos := make([]int, 0)
	depth := 0

	for {
		vPrev := 0
		if depth < len(prev) {
			vPrev = prev[depth]
		}
		
		vNext := Base
		if depth < len(next) {
			vNext = next[depth]
		}

		// Calculate the gap between the two values at the current depth
		gap := vNext - vPrev

		if gap > 1 {
			// There is room at this level! Pick a number in between.
			// Using a random offset prevents predictable collision patterns.
			offset := rand.Intn(gap-1) + 1 
			newPos = append(newPos, vPrev+offset)
			return newPos
		} else if gap == 1 {
			// No room between them at this level (e.g., 1 and 2).
			// We must copy the left value and go one level deeper.
			newPos = append(newPos, vPrev)
		} else {
			// vPrev == vNext, go deeper
			newPos = append(newPos, vPrev)
		}

		depth++
	}
}