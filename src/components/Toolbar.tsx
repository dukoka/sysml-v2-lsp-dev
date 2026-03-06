import { useState } from 'react';

interface ToolbarProps {
  theme: string;
  onThemeChange: (theme: string) => void;
  onNewFile: () => void;
  onFormat: () => void;
  onToggleSidebar: () => void;
  onToggleProblems: () => void;
  sidebarVisible: boolean;
  problemsVisible: boolean;
}

const THEMES = [
  { value: 'vs-dark', label: 'Dark' },
  { value: 'vs-light', label: 'Light' },
  { value: 'sysmlv2-dark', label: 'SysMLv2 Dark' },
];

const SHORTCUTS = [
  { key: 'Ctrl+S', desc: 'Save file' },
  { key: 'Ctrl+N', desc: 'New file' },
  { key: 'Ctrl+Shift+F', desc: 'Format document' },
  { key: 'F12', desc: 'Go to Definition' },
  { key: 'Shift+F12', desc: 'Find References' },
  { key: 'F2', desc: 'Rename Symbol' },
  { key: 'Ctrl+Space', desc: 'Trigger Suggestions' },
  { key: 'Ctrl+Shift+O', desc: 'Go to Symbol' },
  { key: 'Ctrl+G', desc: 'Go to Line' },
  { key: 'Ctrl+/', desc: 'Toggle Comment' },
  { key: 'Ctrl+D', desc: 'Select Next Occurrence' },
  { key: 'Ctrl+Shift+M', desc: 'Toggle Problems' },
  { key: 'Ctrl+B', desc: 'Toggle Sidebar' },
];

function Toolbar({
  theme,
  onThemeChange,
  onNewFile,
  onFormat,
  onToggleSidebar,
  onToggleProblems,
  sidebarVisible,
  problemsVisible,
}: ToolbarProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="toolbar-title">SysMLv2 Editor</span>
          <button className="toolbar-btn" onClick={onNewFile} title="New File (Ctrl+N)">
            +
          </button>
          <div className="toolbar-divider" />
          <button className="toolbar-btn" onClick={onFormat} title="Format (Ctrl+Shift+F)">
            &#x2261;
          </button>
        </div>

        <div className="toolbar-center" />

        <div className="toolbar-right">
          <button
            className={`toolbar-btn ${sidebarVisible ? 'active' : ''}`}
            onClick={onToggleSidebar}
            title="Toggle Sidebar (Ctrl+B)"
          >
            &#x2630;
          </button>
          <button
            className={`toolbar-btn ${problemsVisible ? 'active' : ''}`}
            onClick={onToggleProblems}
            title="Toggle Problems (Ctrl+Shift+M)"
          >
            &#x26A0;
          </button>
          <div className="toolbar-divider" />
          <select
            className="toolbar-select"
            value={theme}
            onChange={(e) => onThemeChange(e.target.value)}
            title="Color Theme"
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <div className="toolbar-divider" />
          <button
            className="toolbar-btn"
            onClick={() => setShowShortcuts(true)}
            title="Keyboard Shortcuts"
          >
            ?
          </button>
        </div>
      </div>

      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowShortcuts(false)}>
              &times;
            </button>
            <h2>Keyboard Shortcuts</h2>
            <table className="shortcut-table">
              <tbody>
                {SHORTCUTS.map((s) => (
                  <tr key={s.key}>
                    <td>{s.desc}</td>
                    <td>
                      <span className="shortcut-key">{s.key}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default Toolbar;
