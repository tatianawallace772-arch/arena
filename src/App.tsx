import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Blocks,
  Code2,
  Copy,
  Eye,
  EyeOff,
  Flag,
  GitBranch,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Minimize2,
  Moon,
  Music,
  Palette,
  Plus,
  RefreshCw,
  Smartphone,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
import { updateBlocklyDynamicContext } from './blockly/setupBlockly';
import type { BlocklyBlockNode } from './blockly/astTypes';
import { AppUIDesigner } from './components/AppUIDesigner';
import { BlocklyEditor } from './components/BlocklyEditor';
import { CodePreviewPanel } from './components/CodePreviewPanel';
import { CostumeEditor } from './components/CostumeEditor';
import { SoundStudio } from './components/SoundStudio';
import { StageCanvas, type StageCanvasHandle } from './components/StageCanvas';
import {
  BackdropLibraryModal,
  PublishGitHubModal,
  SpriteLibraryModal,
  TemplatesModal,
  VariableModal,
} from './components/StudioModals';
import { BUILTIN_SOUNDS, type LibrarySpriteItem } from './data/assets';
import { createDefaultProject, type ProjectTemplateMeta } from './data/templates';
import { ScratchAppVM } from './engine/vm';
import type {
  AppWidget,
  AppWidgetType,
  BackdropModel,
  Costume,
  ProjectModel,
  SoundAsset,
  SpriteModel,
  StageMode,
  VariableModel,
} from './types/studio';

type StudioTab = 'code' | 'costumes' | 'sounds' | 'appui' | 'preview';
type ActiveModal = 'sprites' | 'backdrops' | 'variables' | 'templates' | 'publish' | null;

const STORAGE_KEY = 'blockcraft_studio_project_v1';

function loadInitialProject(): ProjectModel {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ProjectModel;
      if (parsed && Array.isArray(parsed.sprites) && parsed.sprites.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage parse failure
  }
  return createDefaultProject();
}

export function App() {
  const [project, setProject] = useState<ProjectModel>(loadInitialProject);
  const [selectedSpriteId, setSelectedSpriteId] = useState<string>(
    () => loadInitialProject().sprites[0]?.id ?? ''
  );
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(
    () => loadInitialProject().widgets[0]?.id ?? null
  );
  const [activeTab, setActiveTab] = useState<StudioTab>('code');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [turboMode, setTurboMode] = useState<boolean>(false);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [, setVmTick] = useState<number>(0);

  const [stageToast, setStageToast] = useState<string | null>(null);
  const [askState, setAskState] = useState<{
    question: string;
    spriteName: string;
    resolve: (ans: string) => void;
  } | null>(null);

  const stageRef = useRef<StageCanvasHandle | null>(null);
  const vmRef = useRef<ScratchAppVM | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  const [workspaceRevision, setWorkspaceRevision] = useState<number>(0);

  const activeSprite = useMemo(
    () => project.sprites.find((s) => s.id === selectedSpriteId) ?? project.sprites[0],
    [project.sprites, selectedSpriteId]
  );

  // Sync dynamic menus synchronously so child BlocklyEditor effects always see fresh options
  useMemo(() => {
    if (!activeSprite) return;
    const otherSprites = project.sprites
      .filter((s) => s.id !== activeSprite.id)
      .map((s): [string, string] => [s.name, s.name]);

    const spriteSounds = activeSprite.sounds.length > 0 ? activeSprite.sounds : BUILTIN_SOUNDS;

    updateBlocklyDynamicContext({
      costumes: activeSprite.costumes.map((c) => [c.name, c.name]),
      sounds: spriteSounds.map((s) => [s.name, s.name]),
      sprites: otherSprites,
      backdrops: project.backdrops.map((b) => [b.name, b.name]),
      widgets:
        project.widgets.length > 0
          ? project.widgets.map((w) => [w.id, w.id])
          : [['my_btn', 'my_btn']],
      variables:
        project.variables.length > 0
          ? project.variables.map((v) => [v.name, v.name])
          : [['score', 'score']],
    });
  }, [activeSprite, project.sprites, project.backdrops, project.widgets, project.variables]);

  // Auto-save debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch {
        // quota exceeded fallback
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [project]);

  // Instantiate VM once
  useEffect(() => {
    const vm = new ScratchAppVM({
      onStateChange: () => {
        setVmTick((n) => (n + 1) % 1_000_000);
      },
      onPenLine: (x1, y1, x2, y2, color, size) => {
        stageRef.current?.drawPenLine(x1, y1, x2, y2, color, size);
      },
      onPenStamp: (sp) => {
        stageRef.current?.stampSprite(sp);
      },
      onPenClear: () => {
        stageRef.current?.clearPen();
      },
      onSpawnParticles: (kind, count, x, y) => {
        stageRef.current?.spawnParticles(kind, count, x, y);
      },
      onScreenShake: (power) => {
        stageRef.current?.shakeScreen(power);
      },
      onToast: (msg) => {
        setStageToast(msg);
        setTimeout(() => {
          setStageToast((cur) => (cur === msg ? null : cur));
        }, 2600);
      },
      onAskPrompt: (question, spriteName) => {
        return new Promise<string>((resolve) => {
          setAskState({ question, spriteName, resolve });
        });
      },
      onSwitchBackdrop: (nameOrNext, isNext) => {
        setProject((prev) => {
          if (isNext) {
            return {
              ...prev,
              currentBackdropIndex:
                (prev.currentBackdropIndex + 1) % Math.max(1, prev.backdrops.length),
            };
          }
          const idx = prev.backdrops.findIndex(
            (b) => b.name === nameOrNext || b.id === nameOrNext
          );
          return idx >= 0 ? { ...prev, currentBackdropIndex: idx } : prev;
        });
      },
    });
    vmRef.current = vm;
    return () => vm.destroy();
  }, []);

  // Keep VM synced with React project state
  useEffect(() => {
    const vm = vmRef.current;
    if (!vm) return;
    vm.turboMode = turboMode;
    vm.syncProjectState(
      project.sprites,
      project.widgets,
      project.variables,
      project.stageMode,
      project.tempo
    );
  }, [project, turboMode]);

  // Global keyboard sensing for stage play
  useEffect(() => {
    const isTypingInput = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingInput(e.target)) return;
      const vm = vmRef.current;
      if (!vm) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      const alreadyDown = vm.pressedKeys.has(e.key);
      vm.pressedKeys.add(e.key);
      if (!alreadyDown) {
        vm.triggerKeyPressed(e.key);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      vmRef.current?.pressedKeys.delete(e.key);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleGreenFlag = () => {
    vmRef.current?.triggerGreenFlag();
  };

  const handleStopAll = () => {
    vmRef.current?.stopAll();
    setAskState(null);
  };

  const handleWorkspaceChange = useCallback(
    (spriteId: string, state: Record<string, unknown>) => {
      setProject((prev) => ({
        ...prev,
        sprites: prev.sprites.map((sp) =>
          sp.id === spriteId ? { ...sp, workspaceState: state } : sp
        ),
      }));
    },
    []
  );

  const updateActiveSprite = (patch: Partial<SpriteModel>) => {
    if (!activeSprite) return;
    setProject((prev) => ({
      ...prev,
      sprites: prev.sprites.map((s) =>
        s.id === activeSprite.id ? { ...s, ...patch } : s
      ),
    }));
  };

  const handleAddLibrarySprite = (item: LibrarySpriteItem) => {
    const id = `sprite_${Date.now()}`;
    const existingNames = new Set(project.sprites.map((s) => s.name));
    let finalName = item.name;
    let suffix = 2;
    while (existingNames.has(finalName)) {
      finalName = `${item.name} ${suffix++}`;
    }
    const newSp: SpriteModel = {
      id,
      name: finalName,
      x: Math.round((Math.random() - 0.5) * 140),
      y: Math.round((Math.random() - 0.5) * 90),
      size: item.defaultSize,
      direction: 90,
      rotationStyle: 'left-right',
      visible: true,
      draggable: true,
      layerOrder: project.sprites.length + 1,
      costumes: item.costumes.map((c) => ({ ...c, id: `${c.id}_${Date.now()}` })),
      currentCostumeIndex: 0,
      sounds: item.defaultSounds.map((s) => ({ ...s })),
      effects: { color: 0, brightness: 0, ghost: 0, fisheye: 0, whirl: 0, pixelate: 0 },
      bubble: null,
      pen: { isDown: false, color: '#7C3AED', size: 4, hue: 265 },
      physics: { vx: 0, vy: 0, gravity: 0, bounce: 0.5 },
      workspaceState: { blocks: { languageVersion: 0, blocks: [] } },
    };
    setProject((prev) => ({ ...prev, sprites: [...prev.sprites, newSp] }));
    setSelectedSpriteId(id);
  };

  const handleUploadCustomSprite = (name: string, dataUrl: string) => {
    const id = `sprite_${Date.now()}`;
    const newSp: SpriteModel = {
      id,
      name: name || 'Custom Sprite',
      x: 0,
      y: 0,
      size: 45,
      direction: 90,
      rotationStyle: 'left-right',
      visible: true,
      draggable: true,
      layerOrder: project.sprites.length + 1,
      costumes: [{ id: `cost_${Date.now()}`, name: name || 'Costume 1', dataUrl }],
      currentCostumeIndex: 0,
      sounds: [BUILTIN_SOUNDS[0], BUILTIN_SOUNDS[4]],
      effects: { color: 0, brightness: 0, ghost: 0, fisheye: 0, whirl: 0, pixelate: 0 },
      bubble: null,
      pen: { isDown: false, color: '#7C3AED', size: 4, hue: 265 },
      physics: { vx: 0, vy: 0, gravity: 0, bounce: 0.5 },
      workspaceState: { blocks: { languageVersion: 0, blocks: [] } },
    };
    setProject((prev) => ({ ...prev, sprites: [...prev.sprites, newSp] }));
    setSelectedSpriteId(id);
  };

  const handleDuplicateSprite = (sp: SpriteModel) => {
    const copyId = `sprite_${Date.now()}`;
    const copy: SpriteModel = {
      ...JSON.parse(JSON.stringify(sp)),
      id: copyId,
      name: `${sp.name} Copy`,
      x: sp.x + 28,
      y: sp.y - 18,
    };
    setProject((prev) => ({ ...prev, sprites: [...prev.sprites, copy] }));
    setSelectedSpriteId(copyId);
  };

  const handleDeleteSprite = (id: string) => {
    if (project.sprites.length <= 1) return;
    const remaining = project.sprites.filter((s) => s.id !== id);
    setProject((prev) => ({ ...prev, sprites: remaining }));
    if (selectedSpriteId === id && remaining[0]) {
      setSelectedSpriteId(remaining[0].id);
    }
  };

  const handleAddWidget = (type: AppWidgetType) => {
    const idx = project.widgets.length + 1;
    const id = `${type}_${idx}`;
    const defaults: Record<AppWidgetType, Partial<AppWidget>> = {
      button: {
        label: `✨ Button ${idx}`,
        width: 145,
        height: 40,
        color: '#7C3AED',
        textColor: '#FFFFFF',
        borderRadius: 12,
      },
      label: {
        label: `App Title ${idx}`,
        width: 180,
        height: 36,
        color: '#1E293B',
        textColor: '#F8FAFC',
        borderRadius: 10,
      },
      input: {
        label: 'Input',
        placeholder: 'Enter text...',
        value: '',
        width: 190,
        height: 38,
        color: '#FFFFFF',
        textColor: '#0F172A',
        borderRadius: 10,
      },
      slider: {
        label: 'Speed',
        value: '50',
        min: 0,
        max: 100,
        width: 165,
        height: 38,
        color: '#38BDF8',
        textColor: '#FFFFFF',
        borderRadius: 10,
      },
      progress: {
        label: 'Progress',
        value: '40',
        min: 0,
        max: 100,
        width: 210,
        height: 28,
        color: '#10B981',
        textColor: '#FFFFFF',
        borderRadius: 10,
      },
      card: {
        label: 'Card',
        width: 200,
        height: 80,
        color: '#1E293B',
        textColor: '#FFFFFF',
        borderRadius: 14,
      },
    };
    const preset = defaults[type];
    const w: AppWidget = {
      id,
      type,
      label: preset.label ?? id,
      value: preset.value ?? '',
      placeholder: preset.placeholder,
      min: preset.min,
      max: preset.max,
      x: 0,
      y: -80 + ((idx * 26) % 120),
      width: preset.width ?? 140,
      height: preset.height ?? 38,
      color: preset.color ?? '#7C3AED',
      textColor: preset.textColor ?? '#FFFFFF',
      fontSize: 13,
      borderRadius: preset.borderRadius ?? 12,
      visible: true,
    };
    setProject((prev) => ({ ...prev, widgets: [...prev.widgets, w] }));
    setSelectedWidgetId(id);
  };

  const handleLoadTemplate = (tpl: ProjectTemplateMeta) => {
    vmRef.current?.stopAll();
    stageRef.current?.clearPen();
    const fresh = tpl.build();
    setProject(fresh);
    setSelectedSpriteId(fresh.sprites[0]?.id ?? '');
    setSelectedWidgetId(fresh.widgets[0]?.id ?? null);
    setWorkspaceRevision((r) => r + 1);
    setActiveTab('code');
  };

  const allStageSprites = vmRef.current
    ? [...project.sprites, ...vmRef.current.clones]
    : project.sprites;

  const currentBackdrop =
    project.backdrops[project.currentBackdropIndex] ?? project.backdrops[0];

  const isRunning = vmRef.current?.isRunning ?? false;
  const threadCount = vmRef.current?.activeThreadCount ?? 0;

  return (
    <div className={`studio-root ${darkMode ? 'theme-dark' : 'theme-light'}`}>
      {/* TOP STUDIO HEADER */}
      <header className="studio-topbar">
        <div className="brand-cluster">
          <div className="brand-logo" aria-hidden="true">
            <span>🧩</span>
          </div>
          <div className="brand-titles">
            <strong>BlockCraft</strong>
            <span className="engine-pill">Scratch + Google Blockly 13.5</span>
          </div>
        </div>

        <input
          type="text"
          className="project-title-input"
          value={project.title}
          onChange={(e) => setProject((p) => ({ ...p, title: e.target.value }))}
          aria-label="Project title"
        />

        <nav className="topbar-actions">
          <button
            type="button"
            className="top-nav-btn"
            onClick={() => setActiveModal('templates')}
          >
            <Sparkles size={15} />
            <span>Templates</span>
          </button>
          <button
            type="button"
            className="top-nav-btn"
            onClick={() => setActiveModal('variables')}
          >
            <Layers size={15} />
            <span>Variables ({project.variables.length})</span>
          </button>
          <button
            type="button"
            className="top-nav-btn accent"
            onClick={() => setActiveModal('publish')}
          >
            <GitBranch size={15} />
            <span>Export App &amp; GitHub</span>
          </button>
          <button
            type="button"
            className="top-icon-toggle"
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? 'Switch to Scratch Light Studio' : 'Switch to Midnight Dark Studio'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </nav>
      </header>

      {/* MAIN SPLIT WORKSPACE */}
      <main className={`studio-workspace ${theaterMode ? 'theater-active' : ''}`}>
        {/* LEFT COLUMN: EDITOR TABS + ACTIVE STUDIO */}
        {!theaterMode && activeSprite && (
          <section className="editor-column">
            <div className="studio-mode-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'code'}
                className={`mode-tab ${activeTab === 'code' ? 'active' : ''}`}
                onClick={() => setActiveTab('code')}
              >
                <Blocks size={15} />
                <span>Code</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'costumes'}
                className={`mode-tab ${activeTab === 'costumes' ? 'active' : ''}`}
                onClick={() => setActiveTab('costumes')}
              >
                <Palette size={15} />
                <span>Costumes ({activeSprite.costumes.length})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'sounds'}
                className={`mode-tab ${activeTab === 'sounds' ? 'active' : ''}`}
                onClick={() => setActiveTab('sounds')}
              >
                <Music size={15} />
                <span>Sounds</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'appui'}
                className={`mode-tab ${activeTab === 'appui' ? 'active' : ''}`}
                onClick={() => setActiveTab('appui')}
              >
                <Smartphone size={15} />
                <span>App UI ({project.widgets.length})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'preview'}
                className={`mode-tab ${activeTab === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                <Code2 size={15} />
                <span>Live JS / Py</span>
              </button>
            </div>

            <div className="editor-body">
              {/* Keep Blockly mounted with CSS visibility so switching tabs preserves scroll/undo! */}
              <div
                className="tab-pane-fill"
                style={{ display: activeTab === 'code' ? 'flex' : 'none' }}
              >
                <BlocklyEditor
                  activeSprite={activeSprite}
                  projectRevision={workspaceRevision}
                  darkMode={darkMode}
                  onWorkspaceChange={handleWorkspaceChange}
                  onCreateVariable={() => setActiveModal('variables')}
                  onRunSelectedStack={(block: BlocklyBlockNode) =>
                    vmRef.current?.runBlockStackPreview(activeSprite, block)
                  }
                />
              </div>

              {activeTab === 'costumes' && (
                <CostumeEditor
                  sprite={activeSprite}
                  onSelectCostume={(idx) =>
                    updateActiveSprite({ currentCostumeIndex: idx })
                  }
                  onUpdateCostumeData={(costumeId, dataUrl) => {
                    updateActiveSprite({
                      costumes: activeSprite.costumes.map((c) =>
                        c.id === costumeId ? { ...c, dataUrl } : c
                      ),
                    });
                  }}
                  onRenameCostume={(costumeId, name) => {
                    updateActiveSprite({
                      costumes: activeSprite.costumes.map((c) =>
                        c.id === costumeId ? { ...c, name } : c
                      ),
                    });
                  }}
                  onAddCostume={(costume: Costume) => {
                    const next = [...activeSprite.costumes, costume];
                    updateActiveSprite({
                      costumes: next,
                      currentCostumeIndex: next.length - 1,
                    });
                  }}
                  onDuplicateCostume={(idx) => {
                    const orig = activeSprite.costumes[idx];
                    if (!orig) return;
                    const dup: Costume = {
                      id: `cost_${Date.now()}`,
                      name: `${orig.name} 2`,
                      dataUrl: orig.dataUrl,
                    };
                    const next = [...activeSprite.costumes];
                    next.splice(idx + 1, 0, dup);
                    updateActiveSprite({ costumes: next, currentCostumeIndex: idx + 1 });
                  }}
                  onDeleteCostume={(idx) => {
                    if (activeSprite.costumes.length <= 1) return;
                    const next = activeSprite.costumes.filter((_, i) => i !== idx);
                    updateActiveSprite({
                      costumes: next,
                      currentCostumeIndex: Math.min(
                        activeSprite.currentCostumeIndex,
                        next.length - 1
                      ),
                    });
                  }}
                />
              )}

              {activeTab === 'sounds' && (
                <SoundStudio
                  sprite={activeSprite}
                  onAddSound={(snd: SoundAsset) =>
                    updateActiveSprite({ sounds: [...activeSprite.sounds, snd] })
                  }
                  onUpdateSound={(soundId, patch) =>
                    updateActiveSprite({
                      sounds: activeSprite.sounds.map((s) =>
                        s.id === soundId ? { ...s, ...patch } : s
                      ),
                    })
                  }
                  onDeleteSound={(soundId) =>
                    updateActiveSprite({
                      sounds: activeSprite.sounds.filter((s) => s.id !== soundId),
                    })
                  }
                />
              )}

              {activeTab === 'appui' && (
                <AppUIDesigner
                  widgets={project.widgets}
                  selectedWidgetId={selectedWidgetId}
                  stageMode={project.stageMode}
                  onSelectWidget={setSelectedWidgetId}
                  onAddWidget={handleAddWidget}
                  onUpdateWidget={(wid, patch) => {
                    setProject((prev) => ({
                      ...prev,
                      widgets: prev.widgets.map((w) =>
                        w.id === wid ? { ...w, ...patch } : w
                      ),
                    }));
                    if (patch.id) setSelectedWidgetId(patch.id);
                  }}
                  onDeleteWidget={(wid) => {
                    setProject((prev) => ({
                      ...prev,
                      widgets: prev.widgets.filter((w) => w.id !== wid),
                    }));
                  }}
                  onChangeStageMode={(stageMode: StageMode) =>
                    setProject((prev) => ({ ...prev, stageMode }))
                  }
                />
              )}

              {activeTab === 'preview' && (
                <CodePreviewPanel
                  activeSprite={activeSprite}
                  allSprites={project.sprites}
                />
              )}
            </div>
          </section>
        )}

        {/* RIGHT COLUMN: STAGE + SPRITE & BACKDROP INSPECTOR */}
        <section className="stage-column">
          {/* Stage Control Bar */}
          <div className="stage-controls-bar">
            <div className="run-group">
              <button
                type="button"
                className={`flag-btn ${isRunning ? 'running' : ''}`}
                onClick={handleGreenFlag}
                title="Run Green Flag scripts"
              >
                <Flag size={16} />
                <span>Run</span>
              </button>
              <button
                type="button"
                className="stop-btn"
                onClick={handleStopAll}
                title="Stop all scripts"
              >
                <Square size={14} />
              </button>
              <button
                type="button"
                className={`turbo-btn ${turboMode ? 'active' : ''}`}
                onClick={() => setTurboMode((t) => !t)}
                title="Toggle Turbo Mode (12x loop speed)"
              >
                <Zap size={14} />
                {turboMode && <span>Turbo</span>}
              </button>
              {threadCount > 0 && (
                <span className="threads-badge">{threadCount} active</span>
              )}
            </div>

            <div className="stage-aspect-group">
              {(
                [
                  ['classic', '4:3'],
                  ['mobile', '📱 App'],
                  ['widescreen', '16:9'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`aspect-chip ${project.stageMode === mode ? 'active' : ''}`}
                  onClick={() => setProject((p) => ({ ...p, stageMode: mode }))}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="stage-right-meta">
              <span className="coord-readout">
                x: {cursorCoords.x} · y: {cursorCoords.y}
              </span>
              <button
                type="button"
                className="icon-ghost"
                onClick={() => stageRef.current?.clearPen()}
                title="Clear Pen Canvas"
              >
                <RefreshCw size={14} />
              </button>
              <button
                type="button"
                className="icon-ghost"
                onClick={() => setTheaterMode((t) => !t)}
                title={theaterMode ? 'Exit Theater Mode' : 'Expand Stage Theater Mode'}
              >
                {theaterMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </div>

          {/* Interactive Stage */}
          <StageCanvas
            ref={stageRef}
            stageMode={project.stageMode}
            backdrop={currentBackdrop}
            sprites={allStageSprites}
            selectedSpriteId={selectedSpriteId}
            widgets={project.widgets}
            variables={project.variables}
            uiEditMode={activeTab === 'appui'}
            selectedWidgetId={selectedWidgetId}
            askState={
              askState
                ? { question: askState.question, spriteName: askState.spriteName }
                : null
            }
            stageToast={stageToast}
            onSelectSprite={setSelectedSpriteId}
            onSpriteClickedOnStage={(id) => vmRef.current?.triggerSpriteClicked(id)}
            onSpriteMoved={(id, x, y) => {
              const clone = vmRef.current?.clones.find((c) => c.id === id);
              if (clone) {
                clone.x = x;
                clone.y = y;
                setVmTick((n) => n + 1);
                return;
              }
              setProject((prev) => ({
                ...prev,
                sprites: prev.sprites.map((s) =>
                  s.id === id ? { ...s, x: Math.round(x), y: Math.round(y) } : s
                ),
              }));
            }}
            onWidgetClicked={(id) => vmRef.current?.triggerWidgetClicked(id)}
            onWidgetValueChange={(id, value) => {
              setProject((prev) => ({
                ...prev,
                widgets: prev.widgets.map((w) => (w.id === id ? { ...w, value } : w)),
              }));
            }}
            onSelectWidget={setSelectedWidgetId}
            onWidgetMoved={(id, x, y) => {
              setProject((prev) => ({
                ...prev,
                widgets: prev.widgets.map((w) =>
                  w.id === id ? { ...w, x: Math.round(x), y: Math.round(y) } : w
                ),
              }));
            }}
            onVariableSliderChange={(id, value) => {
              setProject((prev) => ({
                ...prev,
                variables: prev.variables.map((v) =>
                  v.id === id ? { ...v, value } : v
                ),
              }));
            }}
            onPointerUpdate={(x, y, down) => {
              setCursorCoords({ x, y });
              if (vmRef.current) {
                vmRef.current.mouseX = x;
                vmRef.current.mouseY = y;
                vmRef.current.mouseDown = down;
              }
            }}
            onSubmitAskAnswer={(ans) => {
              if (askState) {
                askState.resolve(ans);
                setAskState(null);
              }
            }}
          />

          {/* Sprite Inspector + Sprites & Stage Deck */}
          {!theaterMode && activeSprite && (
            <div className="sprite-manager-dock">
              <div className="sprite-props-strip">
                <label className="prop-field grow">
                  <span>Sprite</span>
                  <input
                    type="text"
                    value={activeSprite.name}
                    onChange={(e) => updateActiveSprite({ name: e.target.value })}
                  />
                </label>
                <label className="prop-field num">
                  <span>X</span>
                  <input
                    type="number"
                    value={Math.round(activeSprite.x)}
                    onChange={(e) => updateActiveSprite({ x: Number(e.target.value) })}
                  />
                </label>
                <label className="prop-field num">
                  <span>Y</span>
                  <input
                    type="number"
                    value={Math.round(activeSprite.y)}
                    onChange={(e) => updateActiveSprite({ y: Number(e.target.value) })}
                  />
                </label>
                <label className="prop-field num">
                  <span>Size</span>
                  <input
                    type="number"
                    min={5}
                    max={400}
                    value={Math.round(activeSprite.size)}
                    onChange={(e) =>
                      updateActiveSprite({ size: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="prop-field num">
                  <span>Dir</span>
                  <input
                    type="number"
                    value={Math.round(activeSprite.direction)}
                    onChange={(e) =>
                      updateActiveSprite({ direction: Number(e.target.value) })
                    }
                  />
                </label>
                <button
                  type="button"
                  className={`prop-vis-btn ${activeSprite.visible ? 'shown' : ''}`}
                  onClick={() => updateActiveSprite({ visible: !activeSprite.visible })}
                  title={activeSprite.visible ? 'Hide sprite' : 'Show sprite'}
                >
                  {activeSprite.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>

              <div className="sprites-and-backdrop-row">
                <div className="sprite-cards-scroll">
                  {project.sprites.map((sp) => {
                    const thumb =
                      sp.costumes[sp.currentCostumeIndex] ?? sp.costumes[0];
                    return (
                      <div
                        key={sp.id}
                        className={`sprite-deck-card ${
                          sp.id === activeSprite.id ? 'selected' : ''
                        }`}
                        onClick={() => setSelectedSpriteId(sp.id)}
                      >
                        {thumb && <img src={thumb.dataUrl} alt={sp.name} />}
                        <span className="deck-card-title">{sp.name}</span>
                        <div className="deck-card-mini-btns">
                          <button
                            type="button"
                            title="Duplicate sprite"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateSprite(sp);
                            }}
                          >
                            <Copy size={11} />
                          </button>
                          {project.sprites.length > 1 && (
                            <button
                              type="button"
                              title="Delete sprite"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSprite(sp.id);
                              }}
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    className="add-sprite-tile"
                    onClick={() => setActiveModal('sprites')}
                    title="Add a Sprite"
                  >
                    <Plus size={20} />
                    <span>Add Sprite</span>
                  </button>
                </div>

                {/* Stage Backdrop Selector Card */}
                <button
                  type="button"
                  className="stage-backdrop-tile"
                  onClick={() => setActiveModal('backdrops')}
                  title="Choose or Upload Stage Backdrop"
                >
                  {currentBackdrop && (
                    <img src={currentBackdrop.dataUrl} alt={currentBackdrop.name} />
                  )}
                  <div className="backdrop-tile-caption">
                    <ImageIcon size={12} />
                    <span>Stage</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* MODALS */}
      {activeModal === 'sprites' && (
        <SpriteLibraryModal
          onClose={() => setActiveModal(null)}
          onPickLibrarySprite={handleAddLibrarySprite}
          onUploadCustomSprite={handleUploadCustomSprite}
        />
      )}

      {activeModal === 'backdrops' && (
        <BackdropLibraryModal
          backdrops={project.backdrops}
          currentIndex={project.currentBackdropIndex}
          onClose={() => setActiveModal(null)}
          onSelectIndex={(idx) =>
            setProject((p) => ({ ...p, currentBackdropIndex: idx }))
          }
          onAddBackdrop={(bg: BackdropModel) =>
            setProject((p) => ({
              ...p,
              backdrops: [...p.backdrops, bg],
              currentBackdropIndex: p.backdrops.length,
            }))
          }
        />
      )}

      {activeModal === 'variables' && (
        <VariableModal
          variables={project.variables}
          onClose={() => setActiveModal(null)}
          onCreateVariable={(name) => {
            if (project.variables.some((v) => v.name === name)) return;
            const v: VariableModel = {
              id: `var_${Date.now()}`,
              name,
              value: 0,
              visible: true,
              readout: 'normal',
              sliderMin: 0,
              sliderMax: 100,
              x: -175,
              y: Math.max(-140, 152 - project.variables.length * 32),
            };
            setProject((p) => ({ ...p, variables: [...p.variables, v] }));
          }}
          onUpdateVariable={(id, patch) =>
            setProject((p) => ({
              ...p,
              variables: p.variables.map((v) =>
                v.id === id ? { ...v, ...patch } : v
              ),
            }))
          }
          onDeleteVariable={(id) =>
            setProject((p) => ({
              ...p,
              variables: p.variables.filter((v) => v.id !== id),
            }))
          }
        />
      )}

      {activeModal === 'templates' && (
        <TemplatesModal
          onClose={() => setActiveModal(null)}
          onLoadTemplate={handleLoadTemplate}
        />
      )}

      {activeModal === 'publish' && (
        <PublishGitHubModal
          project={project}
          onClose={() => setActiveModal(null)}
          onImportProjectJson={(imported) => {
            vmRef.current?.stopAll();
            stageRef.current?.clearPen();
            setProject(imported);
            setSelectedSpriteId(imported.sprites[0]?.id ?? '');
            setSelectedWidgetId(imported.widgets[0]?.id ?? null);
            setWorkspaceRevision((r) => r + 1);
          }}
        />
      )}
    </div>
  );
}

export default App;
