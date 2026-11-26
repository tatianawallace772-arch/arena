import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Blocks,
  Camera,
  Check,
  Database,
  Gamepad2,
  Globe2,
  Music,
  Orbit,
  PenTool,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { EXTENSION_TOOLBOX_CATEGORIES } from '../blockly/setupBlockly';
import { SCRATCH_EXTENSIONS, type ScratchExtensionMeta } from '../data/extensions';
import type { ExtensionId } from '../types/studio';

interface ExtensionGalleryModalProps {
  isOpen: boolean;
  enabledExtensions: ExtensionId[];
  onClose: () => void;
  onAddAndFocus: (id: ExtensionId) => void;
  onRemoveExtension: (id: ExtensionId) => void;
  onEnableAll: () => void;
}

const GROUP_FILTERS: Array<'All' | ScratchExtensionMeta['group']> = [
  'All',
  'Official Scratch',
  'App & Cloud',
  'Games & Physics',
];

function renderExtensionIcon(id: ExtensionId) {
  switch (id) {
    case 'music':
      return <Music size={30} />;
    case 'pen':
      return <PenTool size={30} />;
    case 'tts':
      return <Volume2 size={30} />;
    case 'translate':
      return <Globe2 size={30} />;
    case 'video':
      return <Camera size={30} />;
    case 'appui':
      return <Smartphone size={30} />;
    case 'storage':
      return <Database size={30} />;
    case 'physics':
      return <Orbit size={30} />;
    case 'gamepad':
      return <Gamepad2 size={30} />;
    case 'fx':
      return <Sparkles size={30} />;
  }
}

export const ExtensionGalleryModal: React.FC<ExtensionGalleryModalProps> = ({
  isOpen,
  enabledExtensions,
  onClose,
  onAddAndFocus,
  onRemoveExtension,
  onEnableAll,
}) => {
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<'All' | ScratchExtensionMeta['group']>('All');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SCRATCH_EXTENSIONS.filter((ext) => {
      if (activeGroup !== 'All' && ext.group !== activeGroup) return false;
      if (!q) return true;
      return (
        ext.name.toLowerCase().includes(q) ||
        ext.tagline.toLowerCase().includes(q) ||
        ext.featuredBlocks.some((b: string) => b.toLowerCase().includes(q)) ||
        (ext.badge ?? '').toLowerCase().includes(q)
      );
    });
  }, [query, activeGroup]);

  if (!isOpen) return null;

  return (
    <div className="ext-modal-backdrop" onClick={onClose}>
      <div
        className="ext-modal-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a Scratch Extension"
      >
        {/* Scratch-inspired Teal/Indigo Header */}
        <header className="ext-modal-header">
          <div className="ext-modal-title">
            <div className="ext-header-badge">
              <Blocks size={20} />
            </div>
            <div>
              <h2>Choose an Extension</h2>
              <p>
                Snap official Scratch 3.0 & App-Maker block packs directly into your Google Blockly
                palette
              </p>
            </div>
          </div>

          <div className="ext-modal-header-actions">
            {enabledExtensions.length < SCRATCH_EXTENSIONS.length && (
              <button
                type="button"
                className="ext-enable-all-btn"
                onClick={onEnableAll}
                title="Add every Scratch & App-Maker extension to the toolbox"
              >
                <Sparkles size={14} />
                <span>Enable All ({SCRATCH_EXTENSIONS.length})</span>
              </button>
            )}
            <button
              type="button"
              className="ext-close-btn"
              onClick={onClose}
              aria-label="Close extension library"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Search + Group Filter Toolbar */}
        <div className="ext-modal-toolbar">
          <div className="ext-search-box">
            <Search size={15} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Music, Text to Speech, Translate, Video, Physics, Gamepad..."
              autoFocus
            />
          </div>

          <div className="ext-group-pills">
            {GROUP_FILTERS.map((g) => (
              <button
                key={g}
                type="button"
                className={`ext-group-pill ${activeGroup === g ? 'active' : ''}`}
                onClick={() => setActiveGroup(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Extension Cards Grid */}
        <div className="ext-cards-grid">
          {filtered.map((ext) => {
            const isAdded = enabledExtensions.includes(ext.id);
            return (
              <div
                key={ext.id}
                className={`ext-card ${isAdded ? 'is-added' : ''}`}
                onClick={() => onAddAndFocus(ext.id)}
              >
                <div className="ext-card-banner" style={{ background: ext.bannerGradient }}>
                  <span className="ext-card-group-tag">{ext.badge ?? ext.group}</span>
                  {isAdded && (
                    <span className="ext-card-added-pill">
                      <Check size={12} strokeWidth={3} /> Added
                    </span>
                  )}
                  <div className="ext-card-hero-icon">{renderExtensionIcon(ext.id)}</div>
                </div>

                <div className="ext-card-body">
                  <div className="ext-card-head-row">
                    <h3>
                      {ext.emoji} {ext.name}
                    </h3>
                    <span className="ext-block-count">
                      {EXTENSION_TOOLBOX_CATEGORIES[ext.id]?.contents.length ?? 4} blocks
                    </span>
                  </div>
                  <p className="ext-card-desc">{ext.tagline}</p>

                  {/* Sample Block Pills */}
                  <div className="ext-sample-blocks">
                    {ext.featuredBlocks.map((blk: string) => (
                      <span
                        key={blk}
                        className="ext-sample-pill"
                        style={{
                          borderColor: `${ext.accentColor}44`,
                          background: `${ext.accentColor}16`,
                          color: ext.accentColor,
                        }}
                      >
                        {blk}
                      </span>
                    ))}
                  </div>

                  <div className="ext-card-footer">
                    <div className="ext-req-list">
                      <span className="ext-req-chip">{ext.group}</span>
                    </div>

                    <div className="ext-card-cta-group">
                      {isAdded ? (
                        <>
                          <button
                            type="button"
                            className="ext-remove-btn"
                            title={`Remove ${ext.name} from palette`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveExtension(ext.id);
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="ext-open-btn added"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddAndFocus(ext.id);
                            }}
                          >
                            <span>Open Blocks</span>
                            <ArrowRight size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="ext-open-btn"
                          style={{ background: ext.accentColor }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddAndFocus(ext.id);
                          }}
                        >
                          <Plus size={14} strokeWidth={2.6} />
                          <span>Add Extension</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
