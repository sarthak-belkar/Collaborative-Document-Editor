import React, { useRef, useEffect, useCallback } from 'react';
import { getUserMeta } from '../shared/userMeta';

// --- Cursor helpers for contentEditable ---
function getTextOffset(element: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;

  const range = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(element);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function setTextOffset(element: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const len = node.textContent?.length || 0;
    if (currentOffset + len >= offset) {
      range.setStart(node, offset - currentOffset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    currentOffset += len;
  }

  // Offset beyond content — place cursor at end
  range.selectNodeContents(element);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function getEditorText(element: HTMLElement): string {
  // innerText gives visual text with newlines for block elements
  let text = element.innerText || '';
  // Browsers sometimes add a trailing newline for <div><br></div>; keep it
  return text;
}

// --- Component ---

interface DocumentCanvasProps {
  localText: string;
  onTextChange: (prevText: string, newText: string) => void;
  onCursorChange: (position: number) => void;
  editorRef: React.RefObject<HTMLDivElement | null>;
  collaborators: Record<string, { cursor: number; lastActive: number }>;
}

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  localText,
  onTextChange,
  onCursorChange,
  editorRef,
  collaborators,
}) => {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const prevTextRef = useRef<string>('');
  const isLocalChangeRef = useRef(false);

  // Sync DOM ← CRDT for remote updates only
  useEffect(() => {
    if (!editorRef.current) return;

    // Skip if this change was triggered by local input
    if (isLocalChangeRef.current) {
      isLocalChangeRef.current = false;
      prevTextRef.current = localText;
      return;
    }

    const domText = getEditorText(editorRef.current);
    if (domText !== localText) {
      // Remote change — update DOM, save/restore cursor
      const offset = getTextOffset(editorRef.current);
      editorRef.current.innerText = localText;
      setTextOffset(editorRef.current, Math.min(offset, localText.length));
    }
    prevTextRef.current = localText;
  }, [localText, editorRef]);

  // Initialize editor content on first mount
  useEffect(() => {
    if (editorRef.current && localText && !prevTextRef.current) {
      editorRef.current.innerText = localText;
      prevTextRef.current = localText;
    }
  }, [localText, editorRef]);

  // Handle input from contentEditable
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;

    const currentText = getEditorText(editorRef.current);
    const previousText = prevTextRef.current;

    if (currentText === previousText) return;

    isLocalChangeRef.current = true;
    prevTextRef.current = currentText;
    onTextChange(previousText, currentText);
  }, [editorRef, onTextChange]);

  // Handle selection/cursor changes
  const handleSelect = useCallback(() => {
    if (!editorRef.current) return;
    const offset = getTextOffset(editorRef.current);
    onCursorChange(offset);
  }, [editorRef, onCursorChange]);

  // Paste as plain text to avoid HTML garbage
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Scroll mirror to match editor
  const handleScroll = useCallback(() => {
    if (editorRef.current && mirrorRef.current) {
      mirrorRef.current.scrollTop = editorRef.current.scrollTop;
    }
  }, [editorRef]);

  // Render remote caret overlay
  const renderMirrorContent = () => {
    const text = localText;
    const caretsByIndex: Record<number, Array<{ userId: string; name: string; color: string }>> = {};

    Object.entries(collaborators).forEach(([collabId, info]) => {
      if (Date.now() - info.lastActive < 10000) {
        const pos = info.cursor;
        const meta = getUserMeta(collabId);
        if (!caretsByIndex[pos]) caretsByIndex[pos] = [];
        caretsByIndex[pos].push({ userId: collabId, name: meta.name, color: meta.color });
      }
    });

    const indices = Object.keys(caretsByIndex).map(Number).sort((a, b) => a - b);
    const elements: React.ReactNode[] = [];
    let lastIdx = 0;

    indices.forEach((idx) => {
      const clamped = Math.max(0, Math.min(idx, text.length));
      if (clamped > lastIdx) elements.push(text.slice(lastIdx, clamped));

      caretsByIndex[idx].forEach((caret) => {
        elements.push(
          <span key={`caret-${caret.userId}`} className="remote-caret"
            style={{ '--caret-color': caret.color } as React.CSSProperties}>
            <span className="remote-caret-tooltip" style={{ backgroundColor: caret.color }}>
              {caret.name}
            </span>
          </span>
        );
      });
      lastIdx = clamped;
    });

    if (lastIdx < text.length) elements.push(text.slice(lastIdx));
    return elements;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gdocs-bg">
      <div className="flex justify-center py-6 px-4 min-h-full">
        <div
          className="doc-page-shadow bg-white relative"
          style={{ width: '816px', minHeight: '1056px', padding: '96px 72px' }}
        >
          <div className="editor-container">
            {/* Remote caret mirror layer */}
            <div ref={mirrorRef} className="editor-mirror">
              {renderMirrorContent()}
            </div>

            {/* ContentEditable editing surface */}
            <div
              ref={editorRef}
              className="editor-editable"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Type something…"
              onInput={handleInput}
              onSelect={handleSelect}
              onKeyUp={handleSelect}
              onMouseUp={handleSelect}
              onPaste={handlePaste}
              onScroll={handleScroll}
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
