// frontend/src/components/SearchSelect.jsx
import { useState, useRef, useEffect, useMemo } from 'react';
import { X, ChevronDown } from 'lucide-react';

/**
 * Reusable searchable dropdown with "starts with" priority sorting
 * and match highlighting.
 *
 * Props:
 *   options      - Array of { value, label, sub? } or strings
 *   value        - Currently selected value (string)
 *   onChange     - (value, option) => void
 *   placeholder  - Input placeholder text
 *   label        - Optional label rendered above the input
 *   required     - Show red asterisk next to label
 *   disabled     - Disable the input
 *   selectOnly   - When true, disables text input; click opens full list (no search)
 *   maxResults   - Max dropdown items (default 50)
 *   className    - Extra classes for the outer wrapper
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

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const el = listRef.current.children[highlightedIndex];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {cleanLabel}
            {showRequired && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
          onClick={() => { if (!disabled) setIsOpen(prev => !prev); }}
          className={`relative flex items-center w-full pl-3 pr-10 py-2 border rounded-lg bg-white text-sm font-medium cursor-pointer select-none transition-all ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200' : 'border-gray-300 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'} ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
        >
          <span className={`flex-1 truncate ${displayValue ? 'text-gray-900' : 'text-gray-400'}`}>
            {displayValue || placeholder}
          </span>
          {(selectedOption || value) && !disabled ? (
            <button type="button" onClick={handleClear} className="absolute right-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors" title="Clear">
              <X size={16} />
            </button>
          ) : (
            <ChevronDown size={18} className={`absolute right-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </div>

        {isOpen && filtered.length > 0 && (
          <div ref={listRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-60 overflow-y-auto">
            {filtered.map((opt, idx) => (
              <div
                key={opt.value + '-' + idx}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`px-3 py-2 cursor-pointer text-sm ${String(opt.value).trim().toLowerCase() === String(value || '').trim().toLowerCase() ? 'bg-blue-50 text-blue-900 font-semibold' : highlightedIndex === idx ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-50 text-gray-800'}`}
              >
                <div className="font-medium">{opt.label}</div>
                {opt.sub && <div className="text-xs text-gray-500">{opt.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {isOpen && filtered.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-sm z-30 px-3 py-2 text-sm text-gray-500">
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {cleanLabel}
          {showRequired && <span className="text-red-500 ml-1">*</span>}
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
          className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all font-medium disabled:bg-gray-100 disabled:cursor-not-allowed cursor-pointer"
          autoComplete="off"
        />
        {(selectedOption || search || value) ? (
          <button type="button" onClick={handleClear} className="absolute right-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer" title="Clear" disabled={disabled}>
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
            className="absolute right-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            disabled={disabled}
          >
            <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <div ref={listRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-60 overflow-y-auto">
          {filtered.map((opt, idx) => (
            <div
              key={opt.value + '-' + idx}
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-3 py-2 cursor-pointer text-sm ${String(opt.value).trim().toLowerCase() === String(value || '').trim().toLowerCase() ? 'bg-blue-50 text-blue-900 font-semibold' : highlightedIndex === idx ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-50 text-gray-800'}`}
            >
              <div className="font-medium">{renderHighlighted(opt.label)}</div>
              {opt.sub && <div className="text-xs text-gray-500">{opt.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {isOpen && search && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-sm z-30 px-3 py-2 text-sm text-gray-500">
          No results matching "{search}"
        </div>
      )}
    </div>
  );
}
