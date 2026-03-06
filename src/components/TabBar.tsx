import { fileStore } from '../store/fileStore';

interface TabBarProps {
  openTabs: string[];
  activeFileUri: string | null;
  isFileDirty: (uri: string) => boolean;
  getFileName: (uri: string) => string;
}

function TabBar({ openTabs, activeFileUri, isFileDirty, getFileName }: TabBarProps) {
  if (openTabs.length === 0) return null;

  return (
    <div className="tab-bar">
      {openTabs.map((uri) => {
        const isActive = uri === activeFileUri;
        const isDirty = isFileDirty(uri);
        const name = getFileName(uri);

        return (
          <div
            key={uri}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => fileStore.setActiveFile(uri)}
          >
            <span className="tab-icon">&#x25A3;</span>
            <span className="tab-label">{name}</span>
            {isDirty && <span className="tab-dirty" />}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                fileStore.closeTab(uri);
              }}
              title="Close"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default TabBar;
