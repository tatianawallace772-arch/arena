import { X, Trash, Download, Upload, Settings as SettingsIcon } from '../lib/icons';
import { THEMES, type Settings } from '../lib/types';
import { STICKERS } from '../lib/stickers';

type Props = {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onPatch: (patch: Partial<Settings>) => void;
  onReset: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
};

const THEME_PREVIEWS: Record<string, string> = {
  candy: 'linear-gradient(150deg, #fff6e6, #ffe0e6 55%, #d7263d)',
  cookie: 'linear-gradient(150deg, #fdf2e0, #f4dfc3 55%, #a8632f)',
  midnight: 'linear-gradient(150deg, #eef1ff, #e3e7ff 55%, #4656c9)',
  frost: 'linear-gradient(150deg, #f4fbff, #e2f4fd 55%, #2f7fae)',
};

export default function SettingsModal({
  open,
  settings,
  onClose,
  onPatch,
  onReset,
  onExportJson,
  onImportJson,
}: Props) {
  if (!open) return null;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Calendar settings">
        <div className="modal-head">
          <SettingsIcon size={18} />
          <h2>Make it yours</h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="calendar-name">Whose calendar is this?</label>
            <input
              id="calendar-name"
              className="text-input"
              value={settings.name}
              maxLength={40}
              placeholder="e.g. Mia's cozy corner"
              onChange={(e) => onPatch({ name: e.target.value })}
            />
          </div>

          <div className="field">
            <span className="label">Color mood</span>
            <div className="theme-grid">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className="theme-swatch"
                  aria-pressed={settings.theme === t.id}
                  onClick={() => onPatch({ theme: t.id })}
                >
                  <div className="theme-preview" style={{ background: THEME_PREVIEWS[t.id] }} />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">Week starts on</span>
            <div className="seg">
              <button aria-pressed={settings.weekStart === 0} onClick={() => onPatch({ weekStart: 0 })}>
                Sunday
              </button>
              <button aria-pressed={settings.weekStart === 1} onClick={() => onPatch({ weekStart: 1 })}>
                Monday
              </button>
            </div>
          </div>

          <div className="field">
            <span className="label">On the page</span>
            <div className="switch-row">
              <div className="label">
                <strong>Holiday markers</strong>
                <span>Emoji and names on festive days</span>
              </div>
              <button
                className="switch"
                role="switch"
                aria-checked={settings.showHolidays}
                aria-label="Show holiday markers"
                onClick={() => onPatch({ showHolidays: !settings.showHolidays })}
              />
            </div>
            <div className="switch-row">
              <div className="label">
                <strong>Note previews</strong>
                <span>Show a snippet of each day’s note</span>
              </div>
              <button
                className="switch"
                role="switch"
                aria-checked={settings.showNotes}
                aria-label="Show note previews"
                onClick={() => onPatch({ showNotes: !settings.showNotes })}
              />
            </div>
            <div className="switch-row">
              <div className="label">
                <strong>Legend</strong>
                <span>Small key under the grid</span>
              </div>
              <button
                className="switch"
                role="switch"
                aria-checked={settings.showLegend}
                aria-label="Show legend"
                onClick={() => onPatch({ showLegend: !settings.showLegend })}
              />
            </div>
          </div>

          <div className="field">
            <span className="label">Your data</span>
            <div className="switch-row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div className="label">
                <strong>Backup & restore</strong>
                <span>{STICKERS.length} stickers available · saved in this browser</span>
              </div>
              <button className="mini-btn" onClick={onExportJson}>
                <Download size={14} /> Export
              </button>
              <label className="mini-btn" style={{ cursor: 'pointer' }}>
                <Upload size={14} /> Import
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImportJson(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <span className="label">Fresh start</span>
            <div className="switch-row">
              <div className="label">
                <strong>Reset the calendar</strong>
                <span>Clears stickers and notes, restores the demo month</span>
              </div>
              <button className="danger-btn" onClick={onReset}>
                <Trash size={14} /> Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
