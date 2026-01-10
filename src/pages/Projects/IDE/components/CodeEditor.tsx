import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';

interface CodeEditorProps {
    code: string;
    onChange: (newCode: string) => void;
    readOnly?: boolean;
}

export interface CodeEditorHandle {
    undo: () => void;
    redo: () => void;
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({ code, onChange, readOnly = false }, ref) => {
    const editorRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
        undo: () => {
            if (editorRef.current && !readOnly) {
                editorRef.current.trigger('keyboard', 'undo', null);
            }
        },
        redo: () => {
            if (editorRef.current && !readOnly) {
                editorRef.current.trigger('keyboard', 'redo', null);
            }
        }
    }));

    const handleEditorDidMount: OnMount = (editor) => {
        editorRef.current = editor;
    };

    const handleDrop = (e: React.DragEvent) => {
        if (readOnly) return;
        e.preventDefault();
        const snippet = e.dataTransfer.getData('application/x-code-snippet');

        if (snippet && editorRef.current) {
            const model = editorRef.current.getModel();
            if (!model) return;

            const target = editorRef.current.getTargetAtClientPoint(e.clientX, e.clientY);
            let position = target?.position;

            // Smart Append Logic
            // If dropped below the last line or if position is null (outside content area)
            const lastLine = model.getLineCount();
            // Better check: if the drop Y is greater than the top of the last line + line height
            // But we don't have easy access to layout info here.
            // Instead, rely on Monaco's behavior: if we drop "below", it usually maps to the last line.

            let textToInsert = snippet;
            let insertLine = position?.lineNumber || lastLine;
            let insertColumn = position?.column || 1;

            // If we are at the last line, check if we should append a new line
            if (insertLine === lastLine) {
                const lastLineContent = model.getLineContent(lastLine);
                // If the last line is not empty, or if we want to force a new line "below"
                // We can assume if the user drags to the empty space at the bottom, they want a new line.
                // Monaco clamps the position to the last column of the last line.

                // Let's just always append a newline if we are at the end of the file and it's not empty
                if (lastLineContent.trim() !== '') {
                    textToInsert = '\n' + snippet;
                    insertColumn = model.getLineMaxColumn(lastLine);
                }
            } else if (position) {
                // Normal insertion check
                const lineContent = model.getLineContent(position.lineNumber);
                if (lineContent.trim() !== '') {
                    textToInsert = '\n' + snippet;
                    insertColumn = model.getLineMaxColumn(position.lineNumber);
                }
            }

            editorRef.current.executeEdits('dnd', [{
                range: {
                    startLineNumber: insertLine,
                    startColumn: insertColumn,
                    endLineNumber: insertLine,
                    endColumn: insertColumn,
                },
                text: textToInsert,
                forceMoveMarkers: true
            }]);

            // Update state
            onChange(editorRef.current.getValue());
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (readOnly) return;
        e.preventDefault();
    };

    return (
        <div
            className="h-full w-full code-editor-container"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <style>{`
        .monaco-editor .margin {
          border-right: 1px solid #E0E0E0;
        }
      `}</style>
            <Editor
                height="100%"
                language="cpp"
                value={code}
                onChange={(value) => !readOnly && onChange(value || '')}
                onMount={handleEditorDidMount}
                theme="vs-light"
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    lineNumbersMinChars: 3,
                    folding: false,
                    glyphMargin: false,
                    scrollBeyondLastLine: true, // Allow scrolling past end to make it easier to drop below
                    automaticLayout: true,
                    tabSize: 2,
                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    renderLineHighlight: 'none', // Clean look
                    readOnly: readOnly,
                }}
            />
        </div>
    );
});

export default CodeEditor;
