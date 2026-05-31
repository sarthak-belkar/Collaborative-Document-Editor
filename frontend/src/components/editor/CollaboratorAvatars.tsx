import React from 'react';
import { UserAvatar } from '../shared/UserAvatar';

interface CollaboratorAvatarsProps {
  collaborators: Record<string, { cursor: number; lastActive: number }>;
  myUserId: string;
}

export const CollaboratorAvatars: React.FC<CollaboratorAvatarsProps> = ({
  collaborators,
  myUserId,
}) => {
  const activeUserIds = Object.keys(collaborators).filter(
    (id) => Date.now() - collaborators[id].lastActive < 10000
  );

  const maxVisible = 4;
  const visibleUsers = activeUserIds.slice(0, maxVisible);
  const overflow = activeUserIds.length - maxVisible;

  return (
    <div className="flex items-center">
      {/* Active collaborator avatars (stacked) */}
      <div className="flex -space-x-1.5">
        {visibleUsers.map((userId) => (
          <UserAvatar
            key={userId}
            userId={userId}
            size="md"
            showPresence
            className="ring-2 ring-white hover:z-10 hover:scale-110 transition-transform duration-150"
          />
        ))}
      </div>

      {/* Overflow count */}
      {overflow > 0 && (
        <div className="ml-1 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gdocs-text-secondary ring-2 ring-white">
          +{overflow}
        </div>
      )}

      {/* Current user avatar */}
      <div className="ml-3">
        <UserAvatar
          userId={myUserId}
          size="lg"
          isYou
          className="ring-2 ring-white"
        />
      </div>
    </div>
  );
};
