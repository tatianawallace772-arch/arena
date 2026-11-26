import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileJson,
  FolderArchive,
  GitBranch,
  Globe,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  BACKDROP_LIBRARY,
  type LibrarySpriteItem,
  SPRITE_LIBRARY,
} from '../data/assets';
import { PROJECT_TEMPLATES, type ProjectTemplateMeta } from '../data/templates';
import { buildStandaloneHtmlApp, exportGitHubRepoZip } from '../engine/exporter';
import type { BackdropModel, ProjectModel, VariableModel } from '../types/studio';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ---------- SPRITE LIBRARY MODAL ----------
export const SpriteLibraryModal: React.FC<{
  onClose: () => void;
  onPickLibrarySprite: (item: LibrarySpriteItem) => void;
  onUploadCustomSprite: (name: string, dataUrl: string) => void;
}> = ({ onClose, onPickLibrarySprite, onUploadCustomSprite }) => {
  const [cat, setCat] = useState<string>('All');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const filtered =
    cat === 'All'
      ? SPRITE_LIBRARY
      : SPRITE_LIBRARY.filter((s) => s.category === cat);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="studio-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Choose a Sprite</h3>
            <p>Pick a ready-made multi-costume character or upload your own artwork.</p>
          </div>
          <button type="button" className="icon-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-filter-row">
          {['All', 'Featured', 'Fantasy', 'Games', 'Tech & UI'].map((c) => (
            <button
              key={c}
              type="button"
              className={`filter-chip ${cat === c ? 'active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            className="studio-btn primary"
            style={{ marginLeft: 'auto' }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} /> Upload Sprite Image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = new FileReader();
              r.onload = () => {
                if (typeof r.result === 'string') {
                  onUploadCustomSprite(f.name.replace(/\.[^.]+$/, ''), r.result);
                  onClose();
                }
              };
              r.readAsDataURL(f);
            }}
          />
        </div>

        <div className="library-grid">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="library-card"
              onClick={() => {
                onPickLibrarySprite(item);
                onClose();
              }}
            >
              <div className="lib-thumb">
                <img src={item.costumes[0]?.dataUrl} alt={item.name} />
              </div>
              <strong>{item.name}</strong>
              <span>{item.costumes.length} costume(s)</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- BACKDROP LIBRARY MODAL ----------
export const BackdropLibraryModal: React.FC<{
  backdrops: BackdropModel[];
  currentIndex: number;
  onClose: () => void;
  onSelectIndex: (idx: number) => void;
  onAddBackdrop: (bg: BackdropModel) => void;
}> = ({ backdrops, currentIndex, onClose, onSelectIndex, onAddBackdrop }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="studio-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Choose a Stage Backdrop</h3>
            <p>Select a built-in scene or upload a custom background image.</p>
          </div>
          <button type="button" className="icon-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-filter-row">
          <button
            type="button"
            className="studio-btn primary"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} /> Upload Custom Backdrop
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = new FileReader();
              r.onload = () => {
                if (typeof r.result === 'string') {
                  onAddBackdrop({
                    id: `bg_${Date.now()}`,
                    name: f.name.replace(/\.[^.]+$/, ''),
                    dataUrl: r.result,
                  });
                  onClose();
                }
              };
              r.readAsDataURL(f);
            }}
          />
        </div>

        <div className="library-grid backdrops">
          {(backdrops.length > 0 ? backdrops : BACKDROP_LIBRARY).map((bg, idx) => (
            <button
              key={bg.id}
              type="button"
              className={`library-card backdrop-item ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => {
                onSelectIndex(idx);
                onClose();
              }}
            >
              <div className="lib-backdrop-thumb">
                <img src={bg.dataUrl} alt={bg.name} />
              </div>
              <strong>{bg.name}</strong>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- VARIABLE MANAGER MODAL ----------
export const VariableModal: React.FC<{
  variables: VariableModel[];
  onClose: () => void;
  onCreateVariable: (name: string) => void;
  onUpdateVariable: (id: string, patch: Partial<VariableModel>) => void;
  onDeleteVariable: (id: string) => void;
}> = ({ variables, onClose, onCreateVariable, onUpdateVariable, onDeleteVariable }) => {
  const [newName, setNewName] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreateVariable(trimmed);
    setNewName('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="studio-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Variables &amp; Stage Monitors</h3>
            <p>Create variables and configure how they appear on the app stage.</p>
          </div>
          <button type="button" className="icon-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="var-create-row" onSubmit={submit}>
          <input
            type="text"
            placeholder="New variable name (e.g. high_score, speed, lives)..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="studio-btn primary">
            <Plus size={14} /> Add Variable
          </button>
        </form>

        <div className="var-manager-list">
          {variables.map((v) => (
            <div key={v.id} className="var-manager-item">
              <label className="var-check">
                <input
                  type="checkbox"
                  checked={v.visible}
                  onChange={(e) => onUpdateVariable(v.id, { visible: e.target.checked })}
                />
                <strong>{v.name}</strong>
              </label>

              <input
                type="text"
                className="var-val-edit"
                value={String(v.value)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const num = Number(raw);
                  onUpdateVariable(v.id, {
                    value: raw !== '' && !Number.isNaN(num) ? num : raw,
                  });
                }}
              />

              <select
                value={v.readout}
                onChange={(e) =>
                  onUpdateVariable(v.id, {
                    readout: e.target.value as VariableModel['readout'],
                  })
                }
              >
                <option value="normal">Normal badge</option>
                <option value="large">Large counter</option>
                <option value="slider">Interactive slider</option>
              </select>

              {variables.length > 1 && (
                <button
                  type="button"
                  className="icon-ghost"
                  onClick={() => onDeleteVariable(v.id)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- TEMPLATES GALLERY MODAL ----------
export const TemplatesModal: React.FC<{
  onClose: () => void;
  onLoadTemplate: (tpl: ProjectTemplateMeta) => void;
}> = ({ onClose, onLoadTemplate }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="studio-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Starter App &amp; Game Templates</h3>
            <p>Jumpstart your project with interactive Scratch + Google Blockly blueprints.</p>
          </div>
          <button type="button" className="icon-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="templates-grid">
          {PROJECT_TEMPLATES.map((tpl) => (
            <div key={tpl.id} className="template-card">
              <div className="tpl-top">
                <span className="tpl-badge">
                  <Sparkles size={12} /> {tpl.badge}
                </span>
                <h4>{tpl.name}</h4>
                <p>{tpl.description}</p>
              </div>
              <button
                type="button"
                className="studio-btn primary"
                onClick={() => {
                  onLoadTemplate(tpl);
                  onClose();
                }}
              >
                Load Template
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- GITHUB & STANDALONE APP PUBLISHER MODAL ----------
export const PublishGitHubModal: React.FC<{
  project: ProjectModel;
  onClose: () => void;
  onImportProjectJson: (proj: ProjectModel) => void;
}> = ({ project, onClose, onImportProjectJson }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const safeSlug =
    project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'scratch-blockly-app';

  const handleExportHtml = async () => {
    setBusy('html');
    try {
      const html = await buildStandaloneHtmlApp(project);
      downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safeSlug}.html`);
    } finally {
      setBusy(null);
    }
  };

  const handleExportGitHubZip = async () => {
    setBusy('zip');
    try {
      const blob = await exportGitHubRepoZip(project);
      downloadBlob(blob, `${safeSlug}-github-repo.zip`);
    } finally {
      setBusy(null);
    }
  };

  const handleSaveJson = () => {
    const json = JSON.stringify(project, null, 2);
    downloadBlob(
      new Blob([json], { type: 'application/json' }),
      `${safeSlug}.blockcraft.json`
    );
  };

  const ghCliSnippet = `npm install blockly @blockly/continuous-toolbox @blockly/field-angle @blockly/field-colour
git add . && git commit -m "Publish ${project.title} with Google Blockly"
git push origin HEAD`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="studio-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Export App &amp; GitHub + Blockly Hub</h3>
            <p>
              Package <strong>{project.title}</strong> as a standalone HTML5 app or a
              GitHub Pages repository powered by Google Blockly v13.5.
            </p>
          </div>
          <button type="button" className="icon-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="publish-cards-grid">
          <div className="publish-card featured">
            <div className="pub-icon">
              <Globe size={22} />
            </div>
            <h4>Standalone HTML5 Web App</h4>
            <p>
              Compiles all sprites, transparent costumes, UI widgets, sounds, and runtime
              into a single self-contained <code>.html</code> file that runs anywhere offline.
            </p>
            <button
              type="button"
              className="studio-btn primary"
              disabled={busy !== null}
              onClick={() => void handleExportHtml()}
            >
              <Download size={14} />
              {busy === 'html' ? 'Bundling Assets...' : `Download ${safeSlug}.html`}
            </button>
          </div>

          <div className="publish-card">
            <div className="pub-icon github">
              <FolderArchive size={22} />
            </div>
            <h4>GitHub Pages Starter Repo (.zip)</h4>
            <p>
              Includes <code>package.json</code> (with <code>blockly@^13.5.0</code>),{' '}
              <code>index.html</code>, generated JS/Python code, and a GitHub Actions Pages
              workflow!
            </p>
            <button
              type="button"
              className="studio-btn primary"
              disabled={busy !== null}
              onClick={() => void handleExportGitHubZip()}
            >
              <GitBranch size={14} />
              {busy === 'zip' ? 'Creating Repo Zip...' : 'Download GitHub Repo .zip'}
            </button>
          </div>

          <div className="publish-card">
            <div className="pub-icon json">
              <FileJson size={22} />
            </div>
            <h4>Save / Load Project File</h4>
            <p>
              Save your editable BlockCraft project JSON to continue building later or
              share with collaborators.
            </p>
            <div className="btn-pair">
              <button type="button" className="studio-btn" onClick={handleSaveJson}>
                <Download size={14} /> Save .json
              </button>
              <button
                type="button"
                className="studio-btn"
                onClick={() => jsonInputRef.current?.click()}
              >
                <Upload size={14} /> Load .json
              </button>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => {
                    try {
                      const parsed = JSON.parse(String(r.result)) as ProjectModel;
                      if (parsed && Array.isArray(parsed.sprites)) {
                        onImportProjectJson(parsed);
                        onClose();
                      }
                    } catch {
                      alert('Invalid project JSON file.');
                    }
                  };
                  r.readAsText(f);
                }}
              />
            </div>
          </div>
        </div>

        <div className="github-status-box">
          <div className="gh-status-head">
            <span>
              <GitBranch size={15} /> <strong>Google Blockly v13.5.0 Installed</strong> · Zelos Scratch Renderer + Continuous Toolbox Active
            </span>
            <button
              type="button"
              className="mini-action-btn"
              onClick={() => {
                void navigator.clipboard.writeText(ghCliSnippet);
                setCopiedCmd(true);
                setTimeout(() => setCopiedCmd(false), 1600);
              }}
            >
              {copiedCmd ? <Check size={13} /> : <Copy size={13} />}
              {copiedCmd ? 'Copied' : 'Copy Commands'}
            </button>
          </div>
          <pre>{ghCliSnippet}</pre>
        </div>
      </div>
    </div>
  );
};
