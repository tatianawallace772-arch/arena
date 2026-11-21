"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSuggestions } from "@/lib/wiki";

export default function SearchBar({
  initial = "",
  autoFocus = false,
  large = false,
}: {
  initial?: string;
  autoFocus?: boolean;
  large?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const onChange = (v: string) => {
    setValue(v);
    setHighlight(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const s = await getSuggestions(v, 8);
        setSuggestions(s);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 220);
  };

  const submit = (q?: string) => {
    const query = (q ?? value).trim();
    if (!query) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) submit(suggestions[highlight]);
      else submit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className={`searchbar ${large ? "searchbar--large" : ""}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        role="search"
        className="searchbar__form"
      >
        <span className="searchbar__icon" aria-hidden>
          🔍
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder="Search the encyclopedia…"
          aria-label="Search the encyclopedia"
          autoFocus={autoFocus}
          autoComplete="off"
          className="searchbar__input"
        />
        {value && (
          <button
            type="button"
            className="searchbar__clear"
            onClick={() => {
              setValue("");
              setSuggestions([]);
            }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
        <button type="submit" className="searchbar__btn">
          Search
        </button>
      </form>
      {open && suggestions.length > 0 && (
        <ul className="searchbar__suggestions" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === highlight}
              className={i === highlight ? "is-active" : ""}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => submit(s)}
            >
              <span className="searchbar__sugg-icon">📄</span> {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
