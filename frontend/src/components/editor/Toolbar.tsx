import React, { useState, useEffect, useCallback } from 'react';
import {
  Undo2,
  Redo2,
  Printer,
  SpellCheck2,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  Paintbrush,
  Baseline,
  Link2,
  Image,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  IndentDecrease,
  IndentIncrease,
  RemoveFormatting,
  MessageSquarePlus,
  Minus,
  Plus,
} from 'lucide-react';

// Execute a formatting command on the contentEditable selection
function execFormat(command: string, value?: string) {
  document.execCommand(command, false, value);
}

// Check active formatting state from current selection
function queryState(command: string): boolean {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

interface ToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
}

const ToolbarButton: React.FC<{
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  onClick?: () => void;
}> = ({ icon, title, active, onClick }) => (
  <button
    className={`toolbar-btn gdocs-tooltip ${active ? 'active' : ''}`}
    data-tooltip={title}
    onMouseDown={(e) => e.preventDefault()} // Prevent focus loss from editor
    onClick={onClick}
    aria-label={title}
  >
    {icon}
  </button>
);

const ToolbarDivider = () => <div className="toolbar-divider" />;

export const Toolbar: React.FC<ToolbarProps> = ({ editorRef }) => {
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: true,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    insertOrderedList: false,
    insertUnorderedList: false,
  });

  const [fontSize, setFontSize] = useState(11);

  // Update formatting state on selection changes
  const updateFormatState = useCallback(() => {
    setFormatState({
      bold: queryState('bold'),
      italic: queryState('italic'),
      underline: queryState('underline'),
      justifyLeft: queryState('justifyLeft'),
      justifyCenter: queryState('justifyCenter'),
      justifyRight: queryState('justifyRight'),
      justifyFull: queryState('justifyFull'),
      insertOrderedList: queryState('insertOrderedList'),
      insertUnorderedList: queryState('insertUnorderedList'),
    });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', updateFormatState);
    return () => document.removeEventListener('selectionchange', updateFormatState);
  }, [updateFormatState]);

  // Ensure focus returns to editor after command
  const runCommand = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus();
      execFormat(command, value);
      // Update state after command
      setTimeout(updateFormatState, 10);
    },
    [editorRef, updateFormatState]
  );

  const changeFontSize = useCallback(
    (delta: number) => {
      const newSize = Math.max(6, Math.min(72, fontSize + delta));
      setFontSize(newSize);
      editorRef.current?.focus();
      // execCommand fontSize only accepts 1–7, so use CSS instead
      document.execCommand('fontSize', false, '7');
      // Then replace the generated <font size="7"> with actual pt size
      const fontElements = editorRef.current?.querySelectorAll('font[size="7"]');
      fontElements?.forEach((el) => {
        (el as HTMLElement).removeAttribute('size');
        (el as HTMLElement).style.fontSize = `${newSize}pt`;
      });
      setTimeout(updateFormatState, 10);
    },
    [fontSize, editorRef, updateFormatState]
  );

  return (
    <div className="bg-gdocs-toolbar border-b border-gdocs-border-light sticky top-[88px] z-40">
      <div className="flex items-center gap-0.5 px-3 py-1 overflow-x-auto">
        {/* Undo / Redo */}
        <ToolbarButton
          icon={<Undo2 className="w-4 h-4" />}
          title="Undo (Ctrl+Z)"
          onClick={() => runCommand('undo')}
        />
        <ToolbarButton
          icon={<Redo2 className="w-4 h-4" />}
          title="Redo (Ctrl+Y)"
          onClick={() => runCommand('redo')}
        />
        <ToolbarButton
          icon={<Printer className="w-4 h-4" />}
          title="Print (Ctrl+P)"
          onClick={() => window.print()}
        />
        <ToolbarButton
          icon={<SpellCheck2 className="w-4 h-4" />}
          title="Spelling and grammar check"
        />

        <ToolbarDivider />

        {/* Zoom */}
        <button className="toolbar-dropdown min-w-[60px] justify-center" title="Zoom">
          100%
          <ChevronDown className="w-3.5 h-3.5 text-gdocs-text-secondary" />
        </button>

        <ToolbarDivider />

        {/* Font Family */}
        <select
          className="toolbar-dropdown min-w-[110px] cursor-pointer appearance-none"
          title="Font"
          defaultValue="Roboto"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            runCommand('fontName', e.target.value);
          }}
        >
          {['Arial', 'Roboto', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS', 'Comic Sans MS'].map(
            (f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            )
          )}
        </select>

        <ToolbarDivider />

        {/* Font Size */}
        <div className="flex items-center gap-0">
          <button
            className="toolbar-btn !w-6 !h-6"
            title="Decrease font size"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => changeFontSize(-1)}
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="text"
            value={fontSize}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 6 && v <= 72) setFontSize(v);
            }}
            className="w-8 h-7 text-center text-sm border border-gdocs-border rounded bg-white text-gdocs-text outline-none focus:border-gdocs-blue"
            title="Font size"
          />
          <button
            className="toolbar-btn !w-6 !h-6"
            title="Increase font size"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => changeFontSize(1)}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <ToolbarDivider />

        {/* Text Formatting */}
        <ToolbarButton
          icon={<Bold className="w-4 h-4" />}
          title="Bold (Ctrl+B)"
          active={formatState.bold}
          onClick={() => runCommand('bold')}
        />
        <ToolbarButton
          icon={<Italic className="w-4 h-4" />}
          title="Italic (Ctrl+I)"
          active={formatState.italic}
          onClick={() => runCommand('italic')}
        />
        <ToolbarButton
          icon={<Underline className="w-4 h-4" />}
          title="Underline (Ctrl+U)"
          active={formatState.underline}
          onClick={() => runCommand('underline')}
        />
        <ToolbarButton icon={<Baseline className="w-4 h-4" />} title="Text color" />
        <ToolbarButton icon={<Paintbrush className="w-4 h-4" />} title="Highlight color" />

        <ToolbarDivider />

        {/* Insert actions */}
        <ToolbarButton icon={<Link2 className="w-4 h-4" />} title="Insert link (Ctrl+K)" />
        <ToolbarButton icon={<MessageSquarePlus className="w-4 h-4" />} title="Add a comment" />
        <ToolbarButton icon={<Image className="w-4 h-4" />} title="Insert image" />

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton
          icon={<AlignLeft className="w-4 h-4" />}
          title="Left align"
          active={formatState.justifyLeft}
          onClick={() => runCommand('justifyLeft')}
        />
        <ToolbarButton
          icon={<AlignCenter className="w-4 h-4" />}
          title="Center align"
          active={formatState.justifyCenter}
          onClick={() => runCommand('justifyCenter')}
        />
        <ToolbarButton
          icon={<AlignRight className="w-4 h-4" />}
          title="Right align"
          active={formatState.justifyRight}
          onClick={() => runCommand('justifyRight')}
        />
        <ToolbarButton
          icon={<AlignJustify className="w-4 h-4" />}
          title="Justify"
          active={formatState.justifyFull}
          onClick={() => runCommand('justifyFull')}
        />

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          icon={<ListOrdered className="w-4 h-4" />}
          title="Numbered list"
          active={formatState.insertOrderedList}
          onClick={() => runCommand('insertOrderedList')}
        />
        <ToolbarButton
          icon={<List className="w-4 h-4" />}
          title="Bulleted list"
          active={formatState.insertUnorderedList}
          onClick={() => runCommand('insertUnorderedList')}
        />

        <ToolbarDivider />

        {/* Indent */}
        <ToolbarButton
          icon={<IndentDecrease className="w-4 h-4" />}
          title="Decrease indent"
          onClick={() => runCommand('outdent')}
        />
        <ToolbarButton
          icon={<IndentIncrease className="w-4 h-4" />}
          title="Increase indent"
          onClick={() => runCommand('indent')}
        />

        <ToolbarDivider />

        {/* Clear formatting */}
        <ToolbarButton
          icon={<RemoveFormatting className="w-4 h-4" />}
          title="Clear formatting"
          onClick={() => runCommand('removeFormat')}
        />
      </div>
    </div>
  );
};
