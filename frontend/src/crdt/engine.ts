export interface Char {
  id: string; // Globally unique: "{userID}-{counter}"
  value: string; // The character/string
  visible: boolean; // Tombstone status
  position: number[]; // Fractional index
}

export interface Operation {
  id: string;
  userId: string;
  counter: number;
  type: 'insert' | 'delete';
  char?: Char;
  charId?: string; // For delete operations
  timestamp: number;
}

export type VersionVector = Record<string, number>;

export interface CRDTDocument {
  chars: Char[];
}

export function newDocument(): CRDTDocument {
  return { chars: [] };
}

const BASE = 100;

/**
 * Compare two fractional index positions and break ties with user IDs.
 * Returns -1 if char1 < char2, 1 if char1 > char2, and 0 if they are identical.
 */
export function compare(
  pos1: number[],
  pos2: number[],
  id1: string,
  id2: string
): number {
  const maxLen = Math.max(pos1.length, pos2.length);

  for (let i = 0; i < maxLen; i++) {
    const v1 = i < pos1.length ? pos1[i] : 0;
    const v2 = i < pos2.length ? pos2[i] : 0;

    if (v1 < v2) return -1;
    if (v1 > v2) return 1;
  }

  // Tie-breaker using user ID
  if (id1 < id2) return -1;
  if (id1 > id2) return 1;
  return 0;
}

/**
 * Generate a new position strictly between prev and next arrays.
 */
export function generatePosition(prev: number[], next: number[]): number[] {
  const newPos: number[] = [];
  let depth = 0;

  while (true) {
    const vPrev = depth < prev.length ? prev[depth] : 0;
    const vNext = depth < next.length ? next[depth] : BASE;

    const gap = vNext - vPrev;

    if (gap > 1) {
      // Pick a random index within the gap
      const offset = Math.floor(Math.random() * (gap - 1)) + 1;
      newPos.push(vPrev + offset);
      return newPos;
    } else {
      // If gap is 0 or 1, copy left side and go deeper
      newPos.push(vPrev);
    }
    depth++;
  }
}

/**
 * Inserts a character into the CRDTDocument, preserving sorted order.
 */
export function insertChar(doc: CRDTDocument, newChar: Char): void {
  let insertIdx = 0;

  for (let i = 0; i < doc.chars.length; i++) {
    const comp = compare(newChar.position, doc.chars[i].position, newChar.id, doc.chars[i].id);
    if (comp === 0) return; // Already exists (idempotent check)
    if (comp === -1) break;
    insertIdx = i + 1;
  }

  doc.chars.splice(insertIdx, 0, newChar);
}

/**
 * Marks a character as deleted (Tombstone).
 */
export function deleteChar(doc: CRDTDocument, charId: string): void {
  for (let i = 0; i < doc.chars.length; i++) {
    if (doc.chars[i].id === charId) {
      doc.chars[i].visible = false;
      return;
    }
  }
}

/**
 * Reconstructs the visible document string by skipping tombstones.
 */
export function getVisibleString(doc: CRDTDocument): string {
  return doc.chars
    .filter((c) => c.visible)
    .map((c) => c.value)
    .join('');
}

/**
 * Returns a list of visible character objects for positioning calculations.
 */
export function getVisibleChars(doc: CRDTDocument): Char[] {
  return doc.chars.filter((c) => c.visible);
}
