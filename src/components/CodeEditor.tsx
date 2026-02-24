import { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { registerSysmlv2Language, registerSysmlv2Theme, SYSMLV2_LANGUAGE_ID } from '../languages/sysmlv2';
import { createSysmlv2Validator } from '../languages/sysmlv2/validator';

// Configure Monaco workers
self.MonacoEnvironment = {
  getWorker: function (_moduleId: string, label: string) {
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' }
    );
  }
};

// Default SysMLv2 code example
const DEFAULT_SYSMLV2_CODE = `package VehicleExample {
  // Part definitions
  part def Vehicle {
    part engine: Engine;
    part wheels: Wheel[4];
    port fuelIn: FuelPort;
  }

  part def Engine {
    attribute horsepower: Integer;
  }

  // Port definitions
  port def FuelPort {
    in attribute fuelFlow: Real;
  }
}
`;

interface CodeEditorProps {
  language?: string;
  theme?: string;
  initialValue?: string;
  onChange?: (value: string) => void;
}

function CodeEditor({ 
  language = SYSMLV2_LANGUAGE_ID, 
  theme = 'vs-dark',
  initialValue = DEFAULT_SYSMLV2_CODE,
  onChange,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    const init = async () => {
      try {
        console.log('Initializing SysMLv2 editor...');
        
        // Register SysMLv2 language
        registerSysmlv2Language();
        registerSysmlv2Theme();
        
        console.log('Language registered, creating editor...');
        
        // Create editor
        const editor = monaco.editor.create(containerRef.current!, {
          value: initialValue,
          language: language,
          theme: theme,
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 16 },
        });

        if (!mounted) {
          editor.dispose();
          return;
        }

        editorRef.current = editor;
        
        // Debug: check model language
        const model = editor.getModel();
        console.log('Model language:', model?.getLanguageId());
        
        // Handle changes
        editor.onDidChangeModelContent(() => {
          if (onChange) {
            onChange(editor.getValue());
          }
        });

        // Validation
        const validator = createSysmlv2Validator();
        if (model) {
          const markers = validator.validate(model.getValue());
          monaco.editor.setModelMarkers(model, 'sysmlv2', markers);
          
          model.onDidChangeContent(() => {
            const markers = validator.validate(model.getValue());
            monaco.editor.setModelMarkers(model, 'sysmlv2', markers);
          });
        }

        console.log('Editor ready!');
        
      } catch (error) {
        console.error('Init error:', error);
      }
    };

    init();

    return () => {
      mounted = false;
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        minHeight: '400px'
      }} 
    />
  );
}

export default CodeEditor;
