import type { DiagnosticItem } from '../store/fileStore';

interface ProblemsPanelProps {
  diagnostics: DiagnosticItem[];
  errorCount: number;
  warningCount: number;
  expanded: boolean;
  onToggle: () => void;
  onGoToProblem: (line: number, col: number) => void;
}

function ProblemsPanel({
  diagnostics,
  errorCount,
  warningCount,
  expanded,
  onToggle,
  onGoToProblem,
}: ProblemsPanelProps) {
  const severityIcon = (sev: string) => {
    switch (sev) {
      case 'error':
        return <span className="problem-icon error">&#x2716;</span>;
      case 'warning':
        return <span className="problem-icon warning">&#x26A0;</span>;
      default:
        return <span className="problem-icon info">&#x2139;</span>;
    }
  };

  return (
    <div className={`problems-panel ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="problems-panel-header" onClick={onToggle}>
        <div className="problems-panel-title">
          <span>Problems</span>
          {errorCount > 0 && <span className="problems-badge errors">{errorCount}</span>}
          {warningCount > 0 && <span className="problems-badge warnings">{warningCount}</span>}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {expanded ? '\u25BC' : '\u25B2'}
        </span>
      </div>
      {expanded && (
        <div className="problems-panel-body">
          {diagnostics.length === 0 ? (
            <div className="problems-empty">No problems detected</div>
          ) : (
            diagnostics.map((d, i) => (
              <div
                key={i}
                className="problem-item"
                onClick={() => onGoToProblem(d.startLineNumber, d.startColumn)}
              >
                {severityIcon(d.severity)}
                <span className="problem-message">{d.message}</span>
                <span className="problem-location">
                  [{d.startLineNumber}:{d.startColumn}]
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ProblemsPanel;
