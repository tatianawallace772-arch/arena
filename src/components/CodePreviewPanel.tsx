import React, { useMemo, useState } from 'react';
import { Check, Copy, FileCode2 } from 'lucide-react';
import { generateProjectPython, generateSpriteJavaScript } from '../blockly/codePreview';
import type { SpriteModel } from '../types/studio';

interface CodePreviewPanelProps {
  activeSprite: SpriteModel;
  allSprites: SpriteModel[];
}

export const CodePreviewPanel: React.FC<CodePreviewPanelProps> = ({
  activeSprite,
  allSprites,
}) => {
  const [lang, setLang] = useState<'js' | 'python' | 'json'>('js');
  const [copied, setCopied] = useState(false);

  const codeText = useMemo(() => {
    if (lang === 'js') return generateSpriteJavaScript(activeSprite);
    if (lang === 'python') return generateProjectPython(allSprites);
    return JSON.stringify(activeSprite.workspaceState ?? {}, null, 2);
  }, [lang, activeSprite, allSprites]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="code-preview-panel">
      <div className="code-preview-header">
        <div className="code-title-row">
          <FileCode2 size={17} />
          <strong>Live Blockly Code Output</strong>
          <span className="sprite-pill">{activeSprite.name}</span>
        </div>

        <div className="code-lang-tabs">
          <button
            type="button"
            className={lang === 'js' ? 'active' : ''}
            onClick={() => setLang('js')}
          >
            JavaScript (ES2024)
          </button>
          <button
            type="button"
            className={lang === 'python' ? 'active' : ''}
            onClick={() => setLang('python')}
          >
            Python
          </button>
          <button
            type="button"
            className={lang === 'json' ? 'active' : ''}
            onClick={() => setLang('json')}
          >
            Blockly AST (.json)
          </button>
        </div>

        <button type="button" className="studio-btn" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>

      <pre className="code-pre-area">
        <code>{codeText}</code>
      </pre>
    </div>
  );
};
