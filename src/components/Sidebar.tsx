import { useState } from 'react';
import { fileStore, type VirtualFile } from '../store/fileStore';

interface OutlineSymbol {
  name: string;
  kind: string;
  line: number;
  children?: OutlineSymbol[];
}

interface SidebarProps {
  files: VirtualFile[];
  activeFileUri: string | null;
  isFileDirty: (uri: string) => boolean;
  outlineSymbols: OutlineSymbol[];
  onGoToLine: (line: number) => void;
  collapsed: boolean;
}

function Sidebar({ files, activeFileUri, isFileDirty, outlineSymbols, onGoToLine, collapsed }: SidebarProps) {
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [outlineExpanded, setOutlineExpanded] = useState(true);

  if (collapsed) return null;

  const kindIcon = (kind: string): string => {
    switch (kind) {
      case 'package': return '\u{1F4E6}';
      case 'part': return '\u{1F9E9}';
      case 'port': return '\u{1F50C}';
      case 'action': return '\u25B6';
      case 'state': return '\u25C9';
      case 'requirement': return '\u2611';
      case 'attribute': return 'a';
      case 'enum': return 'E';
      default: return '\u25CB';
    }
  };

  const renderOutlineItem = (sym: OutlineSymbol, depth: number) => (
    <div key={`${sym.name}-${sym.line}-${depth}`}>
      <div
        className="outline-item"
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => onGoToLine(sym.line)}
      >
        <span className="outline-item-icon">{kindIcon(sym.kind)}</span>
        <span className="outline-item-name">{sym.name}</span>
        <span className="outline-item-kind">{sym.kind}</span>
      </div>
      {sym.children?.map((child) => renderOutlineItem(child, depth + 1))}
    </div>
  );

  return (
    <div className="sidebar">
      <div className={`sidebar-section ${filesExpanded ? 'expanded' : ''}`}>
        <div className="sidebar-section-header" onClick={() => setFilesExpanded(!filesExpanded)}>
          <span className={`chevron ${filesExpanded ? 'down' : ''}`}>&#x25B6;</span>
          Files
        </div>
        {filesExpanded && (
          <div className="sidebar-section-body">
            {files.map((file) => (
              <div
                key={file.uri}
                className={`file-item ${file.uri === activeFileUri ? 'active' : ''}`}
                onClick={() => fileStore.openTab(file.uri)}
              >
                <span className="file-item-icon">&#x25A3;</span>
                <span className="file-item-name">{file.name}</span>
                {isFileDirty(file.uri) && <span className="file-item-dirty" />}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`sidebar-section ${outlineExpanded ? 'expanded' : ''}`}>
        <div className="sidebar-section-header" onClick={() => setOutlineExpanded(!outlineExpanded)}>
          <span className={`chevron ${outlineExpanded ? 'down' : ''}`}>&#x25B6;</span>
          Outline
        </div>
        {outlineExpanded && (
          <div className="sidebar-section-body">
            {outlineSymbols.length === 0 ? (
              <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                No symbols found
              </div>
            ) : (
              outlineSymbols.map((sym) => renderOutlineItem(sym, 0))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Sidebar;
