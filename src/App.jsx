import { useState } from 'react';
import CodeEditor from './components/CodeEditor';
import { SYSMLV2_LANGUAGE_ID } from './languages/sysmlv2';
import './App.css';

function App() {
  const [theme, setTheme] = useState('vs-dark');
  const [code, setCode] = useState('');

  const themes = [
    { value: 'vs-dark', label: 'Dark' },
    { value: 'vs-light', label: 'Light' },
    { value: 'sysmlv2-dark', label: 'SysMLv2 Dark' }
  ];

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-left">
          <h1>SysMLv2 Editor</h1>
        </div>
        <div className="controls">
          <div className="control-group">
            <label>Theme:</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              {themes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>
      <main className="editor-container">
        <CodeEditor
          language={SYSMLV2_LANGUAGE_ID}
          theme={theme}
          onChange={setCode}
        />
      </main>
      <footer className="footer">
        <span>Characters: {code.length}</span>
        <span className="separator">|</span>
        <span>Language: SysMLv2</span>
      </footer>
    </div>
  );
}

export default App;
