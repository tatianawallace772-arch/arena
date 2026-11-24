import { useEffect, useRef, type ReactNode } from 'react';
import {
  BatteryCharging,
  BedDouble,
  Fuel,
  Route,
  Search,
  Shield as ShieldIcon,
  Trees,
  Utensils,
  X,
} from 'lucide-react';
import { Shield } from './Icons';

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onFocus: () => void;
  onBlur: () => void;
  focused: boolean;
  onDirections: () => void;
  onExitGuide: () => void;
  onQuickCategory: (category: number) => void;
  activeCategory: number | null;
  onToggleRestAreas: () => void;
  restAreasOn: boolean;
  children?: ReactNode;
}

export default function SearchBar({
  query,
  onQueryChange,
  onSubmit,
  onClear,
  onFocus,
  onBlur,
  focused,
  onDirections,
  onExitGuide,
  onQuickCategory,
  activeCategory,
  onToggleRestAreas,
  restAreasOn,
  children,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focused]);

  return (
    <div className="top-panel">
      <div className="search-bar">
        <div className="brand" title="Interstate">
          <Shield highway="I-95" size={24} />
          <span className="brand-word">
            Inter<span>state</span>
          </span>
        </div>
        <input
          ref={inputRef}
          className="search-input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={onFocus}
          onBlur={() => setTimeout(onBlur, 120)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Search exits or places"
          aria-label="Search Interstate"
          spellCheck={false}
          autoComplete="off"
        />
        {query && (
          <button type="button" className="icon-btn" onClick={onClear} aria-label="Clear search">
            <X size={17} />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={onSubmit} aria-label="Search">
          <Search size={17} />
        </button>
        <button
          type="button"
          className="icon-btn primary"
          onClick={onDirections}
          aria-label="Directions"
          title="Directions"
        >
          <Route size={17} />
        </button>
      </div>

      {!focused && !query && (
        <div className="chip-row" aria-label="Quick filters">
          <button type="button" className="chip" onClick={onDirections}>
            <Route size={14} /> Directions
          </button>
          <button type="button" className="chip" onClick={onExitGuide}>
            <ShieldIcon size={14} /> Exit guide
          </button>
          <button type="button" className={`chip${restAreasOn ? ' active' : ''}`} onClick={onToggleRestAreas}>
            <Trees size={14} /> Rest areas
          </button>
          <button
            type="button"
            className={`chip${activeCategory === 5 ? ' active' : ''}`}
            onClick={() => onQuickCategory(5)}
          >
            <BatteryCharging size={14} /> EV charging
          </button>
          <button
            type="button"
            className={`chip${activeCategory === 1 ? ' active' : ''}`}
            onClick={() => onQuickCategory(1)}
          >
            <Fuel size={14} /> Gas
          </button>
          <button
            type="button"
            className={`chip${activeCategory === 2 ? ' active' : ''}`}
            onClick={() => onQuickCategory(2)}
          >
            <Utensils size={14} /> Food
          </button>
          <button
            type="button"
            className={`chip${activeCategory === 3 ? ' active' : ''}`}
            onClick={() => onQuickCategory(3)}
          >
            <BedDouble size={14} /> Lodging
          </button>
        </div>
      )}

      {children}
    </div>
  );
}
