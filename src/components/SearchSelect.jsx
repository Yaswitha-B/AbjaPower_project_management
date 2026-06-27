import { useState, useRef, useEffect } from 'react';
import s from './SearchSelect.module.css';
import { cx } from '../lib/cx.js';

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
    ? items.filter(i => i.toLowerCase().includes(query.toLowerCase()))
    : items;

  const select = (item) => {
    onChange(item);
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

  const showAdd    = onAdd && query.trim() && !items.includes(query.trim());
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
                else if (filtered.length === 1) select(filtered[0]);
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
            {filtered.map(item => (
              <button
                key={item}
                type="button"
                className={cx(s.opt, item === value && s.optOn)}
                onClick={() => select(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
