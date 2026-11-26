import React, { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import { LayoutGrid, Maximize2, PlusCircle, Play } from 'lucide-react';
import {
  initializeScratchBlockly,
  SCRATCH_TOOLBOX_CONFIG,
  scratchDarkTheme,
  scratchLightTheme,
} from '../blockly/setupBlockly';
import type { BlocklyBlockNode } from '../blockly/astTypes';
import type { SpriteModel } from '../types/studio';

interface BlocklyEditorProps {
  activeSprite: SpriteModel;
  projectRevision: number;
  darkMode: boolean;
  onWorkspaceChange: (spriteId: string, state: Record<string, unknown>) => void;
  onCreateVariable: () => void;
  onRunSelectedStack: (block: BlocklyBlockNode) => void;
}

export const BlocklyEditor: React.FC<BlocklyEditorProps> = ({
  activeSprite,
  projectRevision,
  darkMode,
  onWorkspaceChange,
  onCreateVariable,
  onRunSelectedStack,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const isLoadingSpriteRef = useRef(false);
  const activeSpriteIdRef = useRef(activeSprite.id);
  const onChangeRef = useRef(onWorkspaceChange);

  activeSpriteIdRef.current = activeSprite.id;
  onChangeRef.current = onWorkspaceChange;

  // Initialize Blockly workspace once
  useEffect(() => {
    initializeScratchBlockly();
    const el = containerRef.current;
    if (!el) return;

    const ws = Blockly.inject(el, {
      renderer: 'zelos',
      theme: darkMode ? scratchDarkTheme : scratchLightTheme,
      toolbox: SCRATCH_TOOLBOX_CONFIG,
      plugins: {
        toolbox: 'ContinuousToolbox',
        flyoutsVerticalToolbox: 'ContinuousFlyout',
        metricsManager: 'ContinuousMetrics',
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.78,
        maxScale: 1.5,
        minScale: 0.35,
        scaleSpeed: 1.12,
      },
      grid: {
        spacing: 24,
        length: 2,
        colour: darkMode ? '#263248' : '#CBD5E1',
        snap: true,
      },
      move: {
        scrollbars: true,
        drag: true,
        wheel: true,
      },
      trashcan: true,
      sounds: false,
    });

    workspaceRef.current = ws;

    // Load initial sprite blocks
    isLoadingSpriteRef.current = true;
    try {
      if (activeSprite.workspaceState) {
        Blockly.serialization.workspaces.load(activeSprite.workspaceState, ws);
      }
    } catch (err) {
      console.warn('Workspace load warning:', err);
    } finally {
      isLoadingSpriteRef.current = false;
    }

    const listener = (ev: Blockly.Events.Abstract) => {
      if (isLoadingSpriteRef.current || ev.isUiEvent) return;
      const serialized = Blockly.serialization.workspaces.save(ws);
      onChangeRef.current(activeSpriteIdRef.current, serialized);
    };
    ws.addChangeListener(listener);

    const resizeObserver = new ResizeObserver(() => {
      Blockly.svgResize(ws);
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      ws.removeChangeListener(listener);
      ws.dispose();
      workspaceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update theme dynamically
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    ws.setTheme(darkMode ? scratchDarkTheme : scratchLightTheme);
  }, [darkMode]);

  // Swap workspace contents when activeSprite.id changes or template reloads
  const serializedSignature = `${activeSprite.id}::${projectRevision}`;
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    isLoadingSpriteRef.current = true;
    Blockly.Events.disable();
    try {
      ws.clear();
      if (activeSprite.workspaceState) {
        Blockly.serialization.workspaces.load(activeSprite.workspaceState, ws);
      }
      ws.scroll(18, 12);
    } catch (err) {
      console.warn('Error switching sprite workspace:', err);
    } finally {
      Blockly.Events.enable();
      isLoadingSpriteRef.current = false;
      Blockly.svgResize(ws);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedSignature]);

  const handleCleanUp = () => {
    workspaceRef.current?.cleanUp();
  };

  const handleZoomFit = () => {
    workspaceRef.current?.zoomToFit();
  };

  const handleTestSelected = () => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const selected = Blockly.common.getSelected();
    if (selected && selected instanceof Blockly.BlockSvg) {
      const root = selected.getRootBlock();
      const saved = Blockly.serialization.blocks.save(root) as BlocklyBlockNode | null;
      if (saved) {
        onRunSelectedStack(saved);
        return;
      }
    }
    // Otherwise run first hat block in workspace
    const state = Blockly.serialization.workspaces.save(ws) as {
      blocks?: { blocks?: BlocklyBlockNode[] };
    };
    const first = state.blocks?.blocks?.[0];
    if (first) onRunSelectedStack(first);
  };

  const currentCostume = activeSprite.costumes[activeSprite.currentCostumeIndex] ?? activeSprite.costumes[0];

  return (
    <div className="blockly-shell">
      <div className="blockly-floating-bar">
        <button
          type="button"
          className="mini-action-btn primary"
          onClick={onCreateVariable}
          title="Create a new Scratch variable"
        >
          <PlusCircle size={14} />
          <span>New Variable</span>
        </button>
        <button
          type="button"
          className="mini-action-btn"
          onClick={handleTestSelected}
          title="Test selected block stack immediately"
        >
          <Play size={13} />
          <span>Test Stack</span>
        </button>
        <button
          type="button"
          className="mini-action-btn"
          onClick={handleCleanUp}
          title="Neatly align all blocks"
        >
          <LayoutGrid size={13} />
          <span>Tidy</span>
        </button>
        <button
          type="button"
          className="mini-action-btn"
          onClick={handleZoomFit}
          title="Zoom to fit all blocks"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Subtle watermark badge of active sprite in top-right corner of workspace, just like Scratch 3.0! */}
      {currentCostume && (
        <div className="blockly-sprite-watermark" title={`Editing blocks for ${activeSprite.name}`}>
          <img src={currentCostume.dataUrl} alt={activeSprite.name} />
          <span>{activeSprite.name}</span>
        </div>
      )}

      <div ref={containerRef} className="blockly-mount" />
    </div>
  );
};
