import React from 'react';
import {
  Eye,
  EyeOff,
  Gauge,
  MousePointerClick,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Type,
  TextCursorInput,
} from 'lucide-react';
import {
  type AppWidget,
  type AppWidgetType,
  STAGE_DIMENSIONS,
  type StageMode,
} from '../types/studio';

interface AppUIDesignerProps {
  widgets: AppWidget[];
  selectedWidgetId: string | null;
  stageMode: StageMode;
  onSelectWidget: (id: string | null) => void;
  onAddWidget: (type: AppWidgetType) => void;
  onUpdateWidget: (id: string, patch: Partial<AppWidget>) => void;
  onDeleteWidget: (id: string) => void;
  onChangeStageMode: (mode: StageMode) => void;
}

export const AppUIDesigner: React.FC<AppUIDesignerProps> = ({
  widgets,
  selectedWidgetId,
  stageMode,
  onSelectWidget,
  onAddWidget,
  onUpdateWidget,
  onDeleteWidget,
  onChangeStageMode,
}) => {
  const active = widgets.find((w) => w.id === selectedWidgetId) ?? widgets[0] ?? null;

  return (
    <div className="appui-designer">
      <aside className="costume-sidebar">
        <div className="sidebar-head">Add App Widgets</div>
        <div className="widget-palette-stack">
          <button
            type="button"
            className="widget-add-card"
            onClick={() => onAddWidget('button')}
          >
            <MousePointerClick size={16} />
            <div>
              <strong>Button</strong>
              <span>Triggers Blockly click hats</span>
            </div>
          </button>
          <button
            type="button"
            className="widget-add-card"
            onClick={() => onAddWidget('label')}
          >
            <Type size={16} />
            <div>
              <strong>Title / Badge</strong>
              <span>App headers &amp; status text</span>
            </div>
          </button>
          <button
            type="button"
            className="widget-add-card"
            onClick={() => onAddWidget('input')}
          >
            <TextCursorInput size={16} />
            <div>
              <strong>Text Input</strong>
              <span>User forms, names &amp; answers</span>
            </div>
          </button>
          <button
            type="button"
            className="widget-add-card"
            onClick={() => onAddWidget('slider')}
          >
            <SlidersHorizontal size={16} />
            <div>
              <strong>Live Slider</strong>
              <span>Control speed, size or angles</span>
            </div>
          </button>
          <button
            type="button"
            className="widget-add-card"
            onClick={() => onAddWidget('progress')}
          >
            <Gauge size={16} />
            <div>
              <strong>Progress Bar</strong>
              <span>XP, health, or goal meters</span>
            </div>
          </button>
        </div>

        <div className="sidebar-head" style={{ marginTop: 14 }}>
          Stage Widgets ({widgets.length})
        </div>
        <div className="costume-list">
          {widgets.map((w) => (
            <div
              key={w.id}
              className={`sound-card ${active?.id === w.id ? 'active' : ''}`}
              onClick={() => onSelectWidget(w.id)}
            >
              <div className="sound-card-meta">
                <strong>{w.id}</strong>
                <span>
                  {w.type.toUpperCase()} · &ldquo;{w.label}&rdquo;
                </span>
              </div>
              <button
                type="button"
                className="icon-ghost"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onDeleteWidget(w.id);
                }}
                title="Delete widget"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="appui-main">
        <div className="device-frame-banner">
          <div className="banner-info">
            <Smartphone size={18} />
            <div>
              <strong>App Screen Layout Mode</strong>
              <span>Drag widgets directly on the stage while this tab is open!</span>
            </div>
          </div>
          <div className="device-pills">
            {(Object.keys(STAGE_DIMENSIONS) as StageMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`device-pill ${stageMode === m ? 'active' : ''}`}
                onClick={() => onChangeStageMode(m)}
              >
                {STAGE_DIMENSIONS[m].label}
              </button>
            ))}
          </div>
        </div>

        {active ? (
          <div className="widget-inspector-card">
            <div className="inspector-top">
              <div>
                <span className="type-tag">{active.type}</span>
                <h3>Inspecting &ldquo;{active.id}&rdquo;</h3>
              </div>
              <button
                type="button"
                className="studio-btn"
                onClick={() => onUpdateWidget(active.id, { visible: !active.visible })}
              >
                {active.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                {active.visible ? 'Visible' : 'Hidden'}
              </button>
            </div>

            <div className="inspector-form-grid">
              <label>
                <span>Widget ID (referenced in Blockly)</span>
                <input
                  type="text"
                  value={active.id}
                  onChange={(e) =>
                    onUpdateWidget(active.id, {
                      id: e.target.value.replace(/\s+/g, '_'),
                    })
                  }
                />
              </label>
              <label>
                <span>Display Label / Caption</span>
                <input
                  type="text"
                  value={active.label}
                  onChange={(e) => onUpdateWidget(active.id, { label: e.target.value })}
                />
              </label>
              {(active.type === 'input' ||
                active.type === 'slider' ||
                active.type === 'progress') && (
                <label>
                  <span>Initial / Current Value</span>
                  <input
                    type="text"
                    value={active.value}
                    onChange={(e) => onUpdateWidget(active.id, { value: e.target.value })}
                  />
                </label>
              )}
              {active.type === 'input' && (
                <label>
                  <span>Placeholder Hint</span>
                  <input
                    type="text"
                    value={active.placeholder ?? ''}
                    onChange={(e) =>
                      onUpdateWidget(active.id, { placeholder: e.target.value })
                    }
                  />
                </label>
              )}
              {(active.type === 'slider' || active.type === 'progress') && (
                <>
                  <label>
                    <span>Min</span>
                    <input
                      type="number"
                      value={active.min ?? 0}
                      onChange={(e) =>
                        onUpdateWidget(active.id, { min: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    <span>Max</span>
                    <input
                      type="number"
                      value={active.max ?? 100}
                      onChange={(e) =>
                        onUpdateWidget(active.id, { max: Number(e.target.value) })
                      }
                    />
                  </label>
                </>
              )}
              <label>
                <span>X Position</span>
                <input
                  type="number"
                  value={Math.round(active.x)}
                  onChange={(e) => onUpdateWidget(active.id, { x: Number(e.target.value) })}
                />
              </label>
              <label>
                <span>Y Position</span>
                <input
                  type="number"
                  value={Math.round(active.y)}
                  onChange={(e) => onUpdateWidget(active.id, { y: Number(e.target.value) })}
                />
              </label>
              <label>
                <span>Width (px)</span>
                <input
                  type="number"
                  min={48}
                  max={420}
                  value={active.width}
                  onChange={(e) =>
                    onUpdateWidget(active.id, { width: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                <span>Height (px)</span>
                <input
                  type="number"
                  min={24}
                  max={180}
                  value={active.height}
                  onChange={(e) =>
                    onUpdateWidget(active.id, { height: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                <span>Fill / Accent Color</span>
                <div className="color-inline">
                  <input
                    type="color"
                    value={active.color}
                    onChange={(e) => onUpdateWidget(active.id, { color: e.target.value })}
                  />
                  <span>{active.color}</span>
                </div>
              </label>
              <label>
                <span>Text Color</span>
                <div className="color-inline">
                  <input
                    type="color"
                    value={active.textColor}
                    onChange={(e) =>
                      onUpdateWidget(active.id, { textColor: e.target.value })
                    }
                  />
                  <span>{active.textColor}</span>
                </div>
              </label>
              <label>
                <span>Corner Radius ({active.borderRadius}px)</span>
                <input
                  type="range"
                  min={0}
                  max={32}
                  value={active.borderRadius}
                  onChange={(e) =>
                    onUpdateWidget(active.id, { borderRadius: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                <span>Font Size ({active.fontSize}px)</span>
                <input
                  type="range"
                  min={10}
                  max={26}
                  value={active.fontSize}
                  onChange={(e) =>
                    onUpdateWidget(active.id, { fontSize: Number(e.target.value) })
                  }
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="empty-ui-placeholder">
            <MousePointerClick size={32} />
            <h3>No App Widgets Yet</h3>
            <p>
              Click any widget card on the left to drop interactive buttons, inputs,
              sliders, or progress meters onto your app stage — then wire them up in the{' '}
              <strong>App UI</strong> category in Google Blockly!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
