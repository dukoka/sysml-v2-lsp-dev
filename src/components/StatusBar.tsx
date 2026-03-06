import type { CursorPosition } from '../store/fileStore';

interface StatusBarProps {
  cursorPosition: CursorPosition;
  charCount: number;
  lspReady: boolean;
  language: string;
  errorCount: number;
  warningCount: number;
  onToggleProblems: () => void;
}

function StatusBar({
  cursorPosition,
  charCount,
  lspReady,
  language,
  errorCount,
  warningCount,
  onToggleProblems,
}: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-item clickable" onClick={onToggleProblems}>
          {errorCount > 0 && <span>&#x2716; {errorCount}</span>}
          {warningCount > 0 && (
            <span style={{ marginLeft: errorCount > 0 ? 8 : 0 }}>&#x26A0; {warningCount}</span>
          )}
          {errorCount === 0 && warningCount === 0 && <span>&#x2714; No problems</span>}
        </span>
      </div>
      <div className="status-bar-right">
        <span className="status-item">
          Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
        </span>
        <span className="status-item">
          {charCount} chars
        </span>
        <span className="status-item">UTF-8</span>
        <span className="status-item">{language.toUpperCase()}</span>
        <span className="status-item">
          <span className={`status-dot ${lspReady ? 'connected' : 'disconnected'}`} />
          LSP
        </span>
      </div>
    </div>
  );
}

export default StatusBar;
