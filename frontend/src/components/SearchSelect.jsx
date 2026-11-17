// frontend/src/components/SearchSelect.jsx
import { useState, useRef, useEffect, useMemo } from 'react';
import { X, ChevronDown } from 'lucide-react';

/**
 * Reusable searchable dropdown with "starts with" priority sorting
 * and match highlighting.
 */
export default function SearchSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Search...',
  label,
  required = false,
  disabled = false,
  selectOnly = false,
  maxResults = 50,
  className = ''
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Strip trailing * from label and compute single required flag
  const isLabelStr = typeof label === 'string';
  const hasAsterisk = isLabelStr && /\*\s*$/.test(label);
  const cleanLabel = isLabelStr ? label.replace(/\s*\*+\s*$/, '') : label;
  const showRequired = required || hasAsterisk;

  // Normalize options to { value, label, sub?, ...rest }
  const normalized = useMemo(() =>
    (options || []).map(opt => {
      if (!opt && opt !== 0) return { value: '', label: '' };
      if (typeof opt === 'string' || typeof opt === 'number') return { value: String(opt), label: String(opt) };
      const val = opt.value !== undefined ? opt.value : (opt.name || opt.label || '');
      const lbl = String(opt.label || opt.name || val || '');
      return {
        ...opt,
        value: val,
        label: lbl,
        sub: String(opt.sub || opt.Place || opt.place || opt.subtitle || '')
      };
    }),
    [options]
  );

  // Find currently selected option's label
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null || value === '') return null;
    const strVal = String(value).trim().toLowerCase();
    return normalized.find(o =>
      String(o.value).trim().toLowerCase() === strVal ||
      String(o.label).trim().toLowerCase() === strVal
    );
  }, [normalized, value]);

  // Filtered + sorted list (search mode) or full list (selectOnly mode)
  const filtered = useMemo(() => {
    if (selectOnly) return normalized.slice(0, maxResults);
    const query = search.trim().toLowerCase();
    if (!query) return normalized.slice(0, maxResults);
    const matching = normalized.filter(o =>
      String(o.label || '').toLowerCase().includes(query)
    );
    matching.sort((a, b) => {
      const aL = String(a.label || '').toLowerCase();
      const bL = String(b.label || '').toLowerCase();
      const aStarts = aL.startsWith(query);
      const bStarts = bL.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aL.localeCompare(bL);
    });
    return matching.slice(0, maxResults);
  }, [search, normalized, maxResults, selectOnly]);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (opt) => {
    onChange(opt.value, opt);
    setSearch('');
    setIsOpen(false);
    setHighlightedIndex(0);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
    setSearch('');
    setIsOpen(false);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e) => {
    if (selectOnly) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
      return;
    }
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev =>
        prev < filtered.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev =>
        prev > 0 ? prev - 1 : Math.max(0, filtered.length - 1)
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightedIndex]) {
        handleSelect(filtered[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Highlight matching text in a label
  const renderHighlighted = (text) => {
    const textStr = String(text ?? '');
    const query = search.trim().toLowerCase();
    if (!query || selectOnly || !textStr) return textStr;
    const idx = textStr.toLowerCase().indexOf(query);
    if (idx < 0) return textStr;
    return (
      <>
        {textStr.substring(0, idx)}
        <span className="text-blue-600 font-bold">
          {textStr.substring(idx, idx + query.length)}
        </span>
        {textStr.substring(idx + query.length)}
      </>
    );
  };

  const displayValue = selectedOption
    ? selectedOption.label
    : (selectOnly ? (value ? String(value) : '') : (search !== '' ? search : (value ? String(value) : '')));

  // Select-only mode: rendered as a clickable div, not an input
  if (selectOnly) {
    return (
      <div className={`relative ${className}`} ref={containerRef}>
        {label && (
          <label className="block text-base font-semibold text-slate-700 mb-2 flex items-center gap-1">
            <span>{cleanLabel}</span>
            {showRequired && <span className="text-red-500 font-bold ml-0.5">*</span>}
          </label>
        )}
        <div
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
          onClick={() => { if (!disabled) setIsOpen(prev => !prev); }}
          className={`relative min-h-[46px] flex items-center w-full px-4 py-2.5 border rounded-xl bg-white text-base font-medium cursor-pointer select-none transition-all shadow-2xs ${disabled ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' : 'border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'} ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
        >
          <span className={`flex-1 truncate pr-6 ${displayValue ? 'text-slate-800' : 'text-slate-400'}`}>
            {displayValue || placeholder}
          </span>
          {(selectedOption || value) && !disabled ? (
            <button type="button" onClick={handleClear} className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors" title="Clear">
              <X size={16} />
            </button>
          ) : (
            <ChevronDown size={18} className={`absolute right-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </div>

        {isOpen && filtered.length > 0 && (
          <div ref={listRef} className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto custom-scrollbar py-1">
            {filtered.map((opt, idx) => (
              <div
                key={opt.value + '-' + idx}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`px-4 py-2.5 cursor-pointer text-base ${String(opt.value).trim().toLowerCase() === String(value || '').trim().toLowerCase() ? 'bg-blue-50 text-blue-800 font-semibold' : highlightedIndex === idx ? 'bg-blue-50/70 text-blue-900' : 'hover:bg-slate-50 text-slate-700'}`}
              >
                <div className="font-medium">{opt.label}</div>
                {opt.sub && <div className="text-xs text-slate-500 mt-0.5">{opt.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {isOpen && filtered.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 px-4 py-3 text-sm text-slate-400 text-center">
            No options available
          </div>
        )}
      </div>
    );
  }

  // Search mode (default)
  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-base font-semibold text-slate-700 mb-2 flex items-center gap-1">
          <span>{cleanLabel}</span>
          {showRequired && <span className="text-red-500 font-bold ml-0.5">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          type="text"
          value={displayValue}
          onClick={() => {
            if (!disabled) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onChange={(e) => {
            const val = e.target.value;
            if (selectedOption || value) {
              onChange('', null);
            }
            setSearch(val);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full min-h-[46px] px-4 pr-10 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-800 text-base font-medium transition-all shadow-2xs disabled:bg-slate-100 disabled:cursor-not-allowed cursor-pointer"
          autoComplete="off"
        />
        {(selectedOption || search || value) ? (
          <button type="button" onClick={handleClear} className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer" title="Clear" disabled={disabled}>
            <X size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) setIsOpen(prev => !prev);
            }}
            tabIndex={-1}
            className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            disabled={disabled}
          >
            <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <div ref={listRef} className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto custom-scrollbar py-1">
          {filtered.map((opt, idx) => (
            <div
              key={opt.value + '-' + idx}
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-4 py-2.5 cursor-pointer text-base ${String(opt.value).trim().toLowerCase() === String(value || '').trim().toLowerCase() ? 'bg-blue-50 text-blue-800 font-semibold' : highlightedIndex === idx ? 'bg-blue-50/70 text-blue-900' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              <div className="font-medium">{renderHighlighted(opt.label)}</div>
              {opt.sub && <div className="text-xs text-slate-500 mt-0.5">{opt.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {isOpen && search && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 px-4 py-3 text-sm text-slate-400 text-center">
          No results matching "{search}"
        </div>
      )}
    </div>
  );
}
