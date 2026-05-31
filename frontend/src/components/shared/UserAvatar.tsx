import React from 'react';
import { getUserMeta } from './userMeta';

interface UserAvatarProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  showPresence?: boolean;
  isYou?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-9 h-9 text-sm',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  size = 'md',
  showPresence = false,
  isYou = false,
  className = '',
}) => {
  const meta = getUserMeta(userId);
  const sizeClass = sizeMap[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full font-medium text-white cursor-pointer select-none ${sizeClass} ${className}`}
      style={{ backgroundColor: meta.color }}
      title={isYou ? `${meta.name} (You)` : meta.name}
    >
      {meta.initials}

      {/* Presence indicator */}
      {showPresence && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
      )}
    </div>
  );
};
