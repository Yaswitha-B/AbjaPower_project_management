import { useState, useRef, useEffect } from 'react';
import s from './SearchSelect.module.css';
import { cx } from '../lib/cx.js';

// items can be plain strings or { label, tag } objects
function normalise(item) {
  return typeof item === 'string' ? { label: item, tag: null } : item;
}

export default function SearchSelect({
  items = [],
  value,
  onChange,
  onAdd,
  placeholder = 'Select…',
  addLabel = 'item',
  disabled = false,
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const root              = useRef(null);
  const inputRef          = useRef(null);

  const rich = items.map(normalise);

  useEffect(() => {
    const handler = (e) => {
      if (root.current && !root.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = query
    ? rich.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : rich;

  const select = (label) => {
    onChange(label);
    setOpen(false);
    setQuery('');
  };

  const handleAdd = () => {
    const v = query.trim();
    if (!v) return;
    onChange(v);
    if (onAdd) onAdd(v);
    setOpen(false);
    setQuery('');
  };

  const labels      = rich.map(i => i.label);
  const showAdd     = onAdd && query.trim() && !labels.includes(query.trim());
  const canAddBlank = onAdd && !query.trim();

  return (
    <div ref={root} className={cx(s.root, disabled && s.disabled)}>
      <button
        type="button"
        className={s.trigger}
        onClick={() => !disabled && setOpen(o => !o)}
        tabIndex={disabled ? -1 : 0}
      >
        <span className={value ? s.value : s.placeholder}>{value || placeholder}</span>
        <span className={s.caret}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className={s.panel}>
          <input
            ref={inputRef}
            className={s.search}
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (showAdd) handleAdd();
                else if (filtered.length === 1) select(filtered[0].label);
              }
              if (e.key === 'Escape') { setOpen(false); setQuery(''); }
            }}
          />
          <div className={s.list}>
            {onAdd && (
              <button
                type="button"
                className={s.addBtn}
                onClick={handleAdd}
                disabled={!query.trim()}
              >
                {showAdd
                  ? `＋ Add "${query.trim()}"`
                  : canAddBlank
                  ? `＋ Add ${addLabel}…`
                  : `＋ Add "${query.trim()}"`}
              </button>
            )}
            {filtered.length === 0 && (
              <div className={s.empty}>No matches</div>
            )}
            {filtered.map(({ label, tag }) => (
              <button
                key={label}
                type="button"
                className={cx(s.opt, label === value && s.optOn)}
                onClick={() => select(label)}
              >
                <span className={s.optLabel}>{label}</span>
                {tag && <span className={s.optTag}>{tag}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
