import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  newDocument,
  insertChar,
  deleteChar,
  getVisibleString,
  getVisibleChars,
} from '../../crdt/engine';
import type { CRDTDocument, Char, Operation } from '../../crdt/engine';

import { MenuBar } from './MenuBar';
import { Toolbar } from './Toolbar';
import { DocumentCanvas } from './DocumentCanvas';
import { Sidebar } from './Sidebar';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface EditorPageProps {
  documentId: string;
  onBack: () => void;
}

export const EditorPage: React.FC<EditorPageProps> = ({ documentId, onBack }) => {
  const [title, setTitle] = useState('Loading…');
  const [localText, setLocalText] = useState('');
  const [isOfflineSimulated, setIsOfflineSimulated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const crdtDocRef = useRef<CRDTDocument>(newDocument());
  const editorRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<number>(0);
  const isDirtyRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);

  // Rebuild local text from CRDT
  const updateLocalState = useCallback(() => {
    const text = getVisibleString(crdtDocRef.current);
    setLocalText(text);
  }, []);

  // --- Autosave ---
  const saveDocument = useCallback(async () => {
    if (!isDirtyRef.current) return;

    isDirtyRef.current = false;
    setSaveStatus('saving');

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crdt_chars: crdtDocRef.current.chars }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
    } catch (err) {
      console.error('Autosave failed:', err);
      isDirtyRef.current = true; // Retry on next interval
      setSaveStatus('error');
    }
  }, [documentId]);

  const scheduleSave = useCallback(() => {
    isDirtyRef.current = true;
    setSaveStatus('unsaved');

    // Debounce: save 3 seconds after last edit
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveDocument();
    }, 3000);
  }, [saveDocument]);

  // Periodic autosave every 15 seconds (backup)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirtyRef.current) saveDocument();
    }, 15000);
    return () => clearInterval(interval);
  }, [saveDocument]);

  // Save on unmount / page leave
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        // Synchronous save attempt via sendBeacon (POST only)
        const blob = new Blob(
          [JSON.stringify({ crdt_chars: crdtDocRef.current.chars })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(`/api/documents/${documentId}/save`, blob);
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Save on component unmount
      if (isDirtyRef.current) saveDocument();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [documentId, saveDocument]);

  // Fetch document on mount
  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}`);
        if (!res.ok) throw new Error('Document not found');
        const data = await res.json();

        setTitle(data.title || 'Untitled Document');

        if (data.crdt_chars && data.crdt_chars.length > 0) {
          crdtDocRef.current = { chars: data.crdt_chars };
          updateLocalState();
        }
      } catch (err) {
        console.error('Failed to load document:', err);
        setTitle('Untitled Document');
      }
    };
    fetchDoc();
  }, [documentId, updateLocalState]);

  // --- WebSocket callbacks ---
  const handleRemoteOperation = useCallback(
    (op: Operation) => {
      if (op.type === 'insert' && op.char) {
        insertChar(crdtDocRef.current, op.char);
      } else if (op.type === 'delete' && op.charId) {
        deleteChar(crdtDocRef.current, op.charId);
      }
      updateLocalState();
    },
    [updateLocalState]
  );

  const handleRemoteCursor = useCallback((_userId: string, _position: number) => {}, []);
  const handleUserJoin = useCallback((userId: string) => {
    console.log(`User joined: ${userId}`);
  }, []);

  const handleSyncResponse = useCallback(
    (ops: Operation[]) => {
      ops.forEach((op) => {
        if (op.type === 'insert' && op.char) insertChar(crdtDocRef.current, op.char);
        else if (op.type === 'delete' && op.charId) deleteChar(crdtDocRef.current, op.charId);
      });
      updateLocalState();
    },
    [updateLocalState]
  );

  const {
    status,
    userId,
    collaborators,
    toggleOfflineSimulation,
    broadcastOperation,
    broadcastCursor,
  } = useWebSocket({
    documentId,
    onOperation: handleRemoteOperation,
    onCursor: handleRemoteCursor,
    onUserJoin: handleUserJoin,
    onSyncResponse: handleSyncResponse,
  });

  // --- Offline toggle ---
  const handleOfflineToggle = (offline: boolean) => {
    setIsOfflineSimulated(offline);
    toggleOfflineSimulation(offline);
  };

  // --- CRDT neighbor computation ---
  const getNeighbors = (doc: CRDTDocument, k: number) => {
    const visible = getVisibleChars(doc);
    if (visible.length === 0) return { left: null, right: null };

    if (k === 0) {
      const rightChar = visible[0];
      const rightIdx = doc.chars.findIndex((c) => c.id === rightChar.id);
      const leftChar = rightIdx > 0 ? doc.chars[rightIdx - 1] : null;
      return { left: leftChar, right: rightChar };
    } else {
      const leftChar = visible[k - 1];
      const leftIdx = doc.chars.findIndex((c) => c.id === leftChar.id);
      const rightChar = leftIdx + 1 < doc.chars.length ? doc.chars[leftIdx + 1] : null;
      return { left: leftChar, right: rightChar };
    }
  };

  // --- Text change handler (called by DocumentCanvas on contentEditable input) ---
  const handleTextChange = useCallback(
    (prevText: string, currText: string) => {
      if (prevText === currText) return;

      // Detect diff boundaries
      let start = 0;
      while (start < prevText.length && start < currText.length && prevText[start] === currText[start]) {
        start++;
      }

      let prevEnd = prevText.length - 1;
      let currEnd = currText.length - 1;
      while (prevEnd >= start && currEnd >= start && prevText[prevEnd] === currText[currEnd]) {
        prevEnd--;
        currEnd--;
      }

      const deletedLength = prevEnd - start + 1;
      const insertedText = currText.slice(start, currEnd + 1);
      const doc = crdtDocRef.current;

      // Apply deletions
      if (deletedLength > 0) {
        const visible = getVisibleChars(doc);
        for (let i = 0; i < deletedLength; i++) {
          const charToDelete = visible[start + i];
          if (charToDelete) {
            counterRef.current++;
            deleteChar(doc, charToDelete.id);
            broadcastOperation({
              id: Math.random().toString(36).substring(2, 9),
              userId,
              counter: counterRef.current,
              type: 'delete',
              charId: charToDelete.id,
              timestamp: Date.now(),
            });
          }
        }
      }

      // Apply insertions
      if (insertedText.length > 0) {
        for (let i = 0; i < insertedText.length; i++) {
          const charVal = insertedText[i];
          const insertPos = start + i;
          const { left, right } = getNeighbors(doc, insertPos);

          const prevPos = left ? left.position : [];
          const nextPos = right ? right.position : [];

          const newPos: number[] = [];
          let depth = 0;
          let found = false;
          while (!found) {
            const vPrev = depth < prevPos.length ? prevPos[depth] : 0;
            const vNext = depth < nextPos.length ? nextPos[depth] : 100;
            const gap = vNext - vPrev;
            if (gap > 1) {
              newPos.push(vPrev + Math.floor(Math.random() * (gap - 1)) + 1);
              found = true;
            } else {
              newPos.push(vPrev);
            }
            depth++;
          }

          counterRef.current++;
          const newChar: Char = {
            id: `${userId}-${counterRef.current}`,
            value: charVal,
            visible: true,
            position: newPos,
          };

          insertChar(doc, newChar);
          broadcastOperation({
            id: Math.random().toString(36).substring(2, 9),
            userId,
            counter: counterRef.current,
            type: 'insert',
            char: newChar,
            timestamp: Date.now(),
          });
        }
      }

      updateLocalState();
      scheduleSave();
    },
    [userId, broadcastOperation, updateLocalState, scheduleSave]
  );

  // --- Cursor broadcast ---
  const handleCursorChange = useCallback(
    (position: number) => {
      broadcastCursor(position);
    },
    [broadcastCursor]
  );

  return (
    <div className="flex flex-col h-screen bg-gdocs-bg">
      <MenuBar
        title={title}
        onTitleChange={setTitle}
        onBack={onBack}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        status={status}
        isSimulatedOffline={isOfflineSimulated}
        onOfflineToggle={handleOfflineToggle}
        collaborators={collaborators}
        myUserId={userId}
        documentId={documentId}
        saveStatus={saveStatus}
        onSave={saveDocument}
      />

      <Toolbar editorRef={editorRef} />

      <DocumentCanvas
        localText={localText}
        onTextChange={handleTextChange}
        onCursorChange={handleCursorChange}
        editorRef={editorRef}
        collaborators={collaborators}
      />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onBack={onBack}
      />
    </div>
  );
};
