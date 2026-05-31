import React from 'react';
import type { ConnectionStatus } from '../../hooks/useWebSocket';

interface ConnectionBadgeProps {
  status: ConnectionStatus;
  isSimulatedOffline: boolean;
}

export const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({ status, isSimulatedOffline }) => {
  let dotClass = 'offline';
  let label = 'Offline';

  if (isSimulatedOffline) {
    dotClass = 'offline';
    label = 'Offline (Sim)';
  } else if (status === 'CONNECTED') {
    dotClass = 'connected';
    label = 'Connected';
  } else if (status === 'RECONNECTING') {
    dotClass = 'reconnecting';
    label = 'Reconnecting…';
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-gdocs-text-secondary select-none">
      <span className={`connection-dot ${dotClass}`} />
      <span>{label}</span>
    </div>
  );
};
