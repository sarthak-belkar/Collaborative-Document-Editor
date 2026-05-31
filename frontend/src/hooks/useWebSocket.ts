import { useEffect, useRef, useState, useCallback } from 'react';
import type { Operation, VersionVector } from '../crdt/engine';

export type ConnectionStatus = 'CONNECTED' | 'RECONNECTING' | 'OFFLINE';

interface UseWebSocketProps {
  documentId: string;
  onOperation: (op: Operation) => void;
  onCursor: (userId: string, position: number) => void;
  onUserJoin: (userId: string) => void;
  onSyncResponse: (ops: Operation[]) => void;
}

export function useWebSocket({
  documentId,
  onOperation,
  onCursor,
  onUserJoin,
  onSyncResponse,
}: UseWebSocketProps) {
  const [status, setStatus] = useState<ConnectionStatus>('OFFLINE');
  const [userId, setUserId] = useState<string>('');
  const [collaborators, setCollaborators] = useState<Record<string, { cursor: number; lastActive: number }>>({});

  const socketRef = useRef<WebSocket | null>(null);
  const versionVectorRef = useRef<VersionVector>({});
  const counterRef = useRef<number>(0);
  const offlineBufferRef = useRef<Operation[]>([]);
  const isSimulationOfflineRef = useRef<boolean>(false);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Helper to send message if socket is open
  const sendMessage = useCallback((msg: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (isSimulationOfflineRef.current) return;

    setStatus('RECONNECTING');
    const wsUrl = `ws://localhost:8080/ws/${documentId}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Status will transition to CONNECTED once we get the 'join' welcome message containing our client ID
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, userId: msgUserId, documentId: msgDocId } = msg;

        if (msgDocId !== documentId) return;

        switch (type) {
          case 'join':
            if (!userId) {
              console.log('Assigned client ID:', msgUserId);
              setUserId(msgUserId);
              setStatus('CONNECTED');

              // Immediately send a sync_request with our vector
              ws.send(
                JSON.stringify({
                  type: 'sync_request',
                  documentId,
                  userId: msgUserId,
                  versionVector: versionVectorRef.current,
                })
              );
            } else {
              // Notification about another user joining
              onUserJoin(msgUserId);
            }
            break;

          case 'sync_response':
            console.log('Received sync catch-up with operations:', msg.operations);
            const catchupOps = msg.operations || [];
            onSyncResponse(catchupOps);

            // Update our local version vector based on catch-up operations
            catchupOps.forEach((op: Operation) => {
              const currentMax = versionVectorRef.current[op.userId] || 0;
              if (op.counter > currentMax) {
                versionVectorRef.current[op.userId] = op.counter;
              }
            });

            // If we had offline operations, dispatch them now!
            if (offlineBufferRef.current.length > 0) {
              console.log('Sending buffered offline operations:', offlineBufferRef.current.length);
              offlineBufferRef.current.forEach((op) => {
                ws.send(
                  JSON.stringify({
                    type: 'operation',
                    documentId,
                    userId: msgUserId, // will be overwritten by server
                    operationId: op.id,
                    operation: op,
                  })
                );
              });
              offlineBufferRef.current = [];
            }
            break;

          case 'operation':
            if (msg.operation) {
              const op = msg.operation as Operation;
              
              // Skip operations we sent ourselves (deduplication)
              if (op.userId === userId) return;

              // Check if we already have it in version vector
              const highestSeen = versionVectorRef.current[op.userId] || 0;
              if (op.counter > highestSeen) {
                versionVectorRef.current[op.userId] = op.counter;
                onOperation(op);
              }
            }
            break;

          case 'cursor':
            if (msgUserId !== userId && msg.cursor) {
              const pos = msg.cursor.position;
              onCursor(msgUserId, pos);
              setCollaborators((prev) => ({
                ...prev,
                [msgUserId]: { cursor: pos, lastActive: Date.now() },
              }));
            }
            break;
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setStatus('OFFLINE');
      if (!isSimulationOfflineRef.current) {
        // Automatically attempt reconnection
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };
  }, [documentId, userId, onOperation, onCursor, onUserJoin, onSyncResponse]);

  // Clean up on unmount
  useEffect(() => {
    connect();
    return () => {
      isSimulationOfflineRef.current = true; // prevent reconnect
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Toggle offline simulation
  const toggleOfflineSimulation = useCallback((offline: boolean) => {
    isSimulationOfflineRef.current = offline;
    if (offline) {
      console.log('Simulating offline mode: closing WebSocket');
      setStatus('OFFLINE');
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    } else {
      console.log('Reconnecting WebSocket from offline simulation');
      connect();
    }
  }, [connect]);

  // Send operations to server (or buffer if offline)
  const broadcastOperation = useCallback((op: Operation) => {
    // 1. Advance our local counter
    counterRef.current = op.counter;
    versionVectorRef.current[op.userId] = op.counter;

    if (status === 'CONNECTED') {
      sendMessage({
        type: 'operation',
        documentId,
        userId,
        operationId: op.id,
        operation: op,
      });
    } else {
      console.log('Offline: buffering operation', op);
      offlineBufferRef.current.push(op);
    }
  }, [status, documentId, userId, sendMessage]);

  // Send cursor update
  const broadcastCursor = useCallback((position: number) => {
    if (status === 'CONNECTED') {
      sendMessage({
        type: 'cursor',
        documentId,
        userId,
        cursor: { position },
      });
    }
  }, [status, documentId, userId, sendMessage]);

  return {
    status,
    userId,
    collaborators,
    toggleOfflineSimulation,
    broadcastOperation,
    broadcastCursor,
    counter: counterRef.current,
  };
}
