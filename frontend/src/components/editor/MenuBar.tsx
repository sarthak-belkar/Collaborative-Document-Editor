import React, { useState, useRef, useEffect } from 'react';
import type { SaveStatus } from './EditorPage';
import {
  Star,
  FolderOpen,
  Clock,
  MessageSquare,
  Lock,
  Menu,
} from 'lucide-react';
import type { ConnectionStatus } from '../../hooks/useWebSocket';
import { ConnectionBadge } from '../shared/ConnectionBadge';
import { CollaboratorAvatars } from './CollaboratorAvatars';

interface MenuBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onBack: () => void;
  onToggleSidebar: () => void;
  status: ConnectionStatus;
  isSimulatedOffline: boolean;
  onOfflineToggle: (offline: boolean) => void;
  collaborators: Record<string, { cursor: number; lastActive: number }>;
  myUserId: string;
  documentId: string;
  saveStatus: SaveStatus;
  onSave: () => void;
}

const MENU_ITEMS = ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Extensions', 'Help'];

export const MenuBar: React.FC<MenuBarProps> = ({
  title,
  onTitleChange,
  onBack,
  onToggleSidebar,
  status,
  isSimulatedOffline,
  onOfflineToggle,
  collaborators,
  myUserId,
  documentId,
  saveStatus,
  onSave,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [isStarred, setIsStarred] = useState(false);
  const [copied, setCopied] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (localTitle.trim()) {
      onTitleChange(localTitle.trim());
    } else {
      setLocalTitle(title);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(documentId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border-b border-gdocs-border-light sticky top-0 z-50">
      {/* Row 1: Logo + Title + Actions */}
      <div className="flex items-center px-3 py-1.5 gap-2">
        {/* Hamburger / Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className="toolbar-btn !w-10 !h-10"
          title="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Docs Icon */}
        <button
          onClick={onBack}
          className="flex items-center gap-0.5 flex-shrink-0 group"
          title="Back to Docs home"
        >
          <svg viewBox="0 0 48 48" className="w-10 h-10 transition-transform group-hover:scale-105" fill="none">
            <rect x="8" y="4" width="32" height="40" rx="3" fill="#4285F4" />
            <path d="M14 4h20l6 8H14V4z" fill="#3367D6" opacity="0.3" />
            <rect x="14" y="16" width="20" height="2.5" rx="1" fill="white" opacity="0.9" />
            <rect x="14" y="22" width="16" height="2.5" rx="1" fill="white" opacity="0.7" />
            <rect x="14" y="28" width="18" height="2.5" rx="1" fill="white" opacity="0.7" />
            <rect x="14" y="34" width="12" height="2.5" rx="1" fill="white" opacity="0.5" />
          </svg>
        </button>

        {/* Title + metadata */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') {
                    setLocalTitle(title);
                    setIsEditingTitle(false);
                  }
                }}
                className="doc-title-input"
              />
            ) : (
              <h1
                className="doc-title-input truncate cursor-text"
                onClick={() => setIsEditingTitle(true)}
                title="Click to rename"
              >
                {title}
              </h1>
            )}

            {/* Star */}
            <button
              onClick={() => setIsStarred(!isStarred)}
              className="toolbar-btn !w-7 !h-7"
              title={isStarred ? 'Remove from starred' : 'Add to starred'}
            >
              <Star
                className={`w-4 h-4 transition-colors ${
                  isStarred ? 'fill-yellow-400 text-yellow-400' : ''
                }`}
              />
            </button>

            {/* Move to folder */}
            <button className="toolbar-btn !w-7 !h-7" title="Move">
              <FolderOpen className="w-4 h-4" />
            </button>

            {/* Connection Status */}
            <ConnectionBadge status={status} isSimulatedOffline={isSimulatedOffline} />

            {/* Save Status Indicator */}
            <button
              onClick={onSave}
              className="text-xs font-medium px-2 py-0.5 rounded transition-colors select-none"
              title="Click to save now"
            >
              {saveStatus === 'saving' && (
                <span className="text-gdocs-text-muted animate-pulse">Saving…</span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-green-600">✓ Saved</span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="text-gdocs-warning">Unsaved</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-500">Save failed</span>
              )}
            </button>
          </div>

          {/* Row 2: Menu items */}
          <div className="flex items-center gap-0.5 -ml-1 mt-0.5">
            {MENU_ITEMS.map((item) => (
              <button key={item} className="menu-item">
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {/* Offline simulation toggle */}
          <button
            onClick={() => onOfflineToggle(!isSimulatedOffline)}
            className={`toolbar-btn !w-auto px-2 gap-1.5 text-xs font-medium ${
              isSimulatedOffline ? 'bg-red-50 text-red-600' : ''
            }`}
            title="Toggle offline simulation"
          >
            {isSimulatedOffline ? '🔴 Offline' : ''}
          </button>

          {/* History */}
          <button className="toolbar-btn" title="Last edit was seconds ago">
            <Clock className="w-4.5 h-4.5" />
          </button>

          {/* Comments */}
          <button className="toolbar-btn" title="Open comment history">
            <MessageSquare className="w-4.5 h-4.5" />
          </button>

          {/* Share button */}
          <button onClick={handleShare} className="share-btn">
            <Lock className="w-4 h-4" />
            {copied ? 'Copied!' : 'Share'}
          </button>

          {/* Collaborator avatars */}
          <CollaboratorAvatars
            collaborators={collaborators}
            myUserId={myUserId}
          />
        </div>
      </div>
    </div>
  );
};
