// frontend/src/components/SearchSelect.jsx
import { useState, useRef, useEffect, useMemo } from 'react';
import { X, ChevronDown } from 'lucide-react';

/**
 * Reusable searchable dropdown with "starts with" priority sorting
 * and match highlighting.
 *
 * Props:
 *   options      – Array of { value, label, sub? } or strings
 *   value        – Currently selected value (string)
 *   onChange     – (value, option) => void
 *   placeholder  – Input placeholder text
 *   label        – Optional label rendered above the input
 *   required     – Show red asterisk next to label
 *   disabled     – Disable the input
 *   selectOnly   – When true, disables text input; click opens full list (no search)
 *   maxResults   – Max dropdown items (default 50)
 *   className    – Extra classes for the outer wrapper
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

  // Normalize options to { value, label, sub?, ...rest }
  const normalized = useMemo(() =>
    options.map(opt => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      return {
        ...opt,  // preserve all extra fields (e.g. UnitRate, Address, Place)
        value: opt.value !== undefined ? opt.value : opt.name || opt.label || '',
        label: opt.label || opt.name || String(opt.value ?? ''),
        sub: opt.sub || opt.Place || opt.place || opt.subtitle || ''
      };
    }),
    [options]
  );

  // Find currently selected option's label
  const selectedOption = useMemo(
    () => normalized.find(o => String(o.value) === String(value)),
    [normalized, value]
  );

  // Filtered + sorted list (search mode) or full list (selectOnly mode)
  const filtered = useMemo(() => {
    if (selectOnly) return normalized.slice(0, maxResults);
    const query = search.trim().toLowerCase();
    if (!query) return [];
    const matching = normalized.filter(o =>
      o.label.toLowerCase().includes(query)
    );
    matching.sort((a, b) => {
      const aL = a.label.toLowerCase();
      const bL = b.label.toLowerCase();
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
    const query = search.trim().toLowerCase();
    if (!query || selectOnly) return text;
    const idx = text.toLowerCase().indexOf(query);
    if (idx < 0) return text;
    return (
      <>
        {text.substring(0, idx)}
        <span className="text-blue-600 font-bold">
          {text.substring(idx, idx + query.length)}
        </span>
        {text.substring(idx + query.length)}
      </>
    );
  };

  const displayValue = selectedOption ? selectedOption.label : (selectOnly ? '' : search);

  // ── Select-only mode: rendered as a clickable div, not an input ──
  if (selectOnly) {
    return (
      <div className={`relative ${className}`} ref={containerRef}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
          onClick={() => { if (!disabled) setIsOpen(prev => !prev); }}
          className={`relative flex items-center w-full pl-3 pr-10 py-2 border rounded-lg bg-white text-sm font-medium cursor-pointer select-none transition-all
            ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200' : 'border-gray-300 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}
            ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
          `}
        >
          <span className={`flex-1 truncate ${displayValue ? 'text-gray-900' : 'text-gray-400'}`}>
            {displayValue || placeholder}
          </span>
          {selectedOption && !disabled ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
              title="Clear"
            >
              <X size={16} />
            </button>
          ) : (
            <ChevronDown
              size={18}
              className={`absolute right-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          )}
        </div>

        {/* Dropdown list */}
        {isOpen && filtered.length > 0 && (
          <div
            ref={listRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-60 overflow-y-auto"
          >
            {filtered.map((opt, idx) => (
              <div
                key={opt.value + '-' + idx}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`px-3 py-2 cursor-pointer text-sm ${
                  String(opt.value) === String(value)
                    ? 'bg-blue-50 text-blue-900 font-semibold'
                    : highlightedIndex === idx
                    ? 'bg-blue-100 text-blue-900'
                    : 'hover:bg-gray-50 text-gray-800'
                }`}
              >
                <div className="font-medium">{opt.label}</div>
                {opt.sub && (
                  <div className="text-xs text-gray-500">{opt.sub}</div>
                )}
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

  // ── Search mode (default) ──
  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            const val = e.target.value;
            if (selectedOption) {
              // User is editing over a selected value — clear it
              onChange('', null);
            }
            setSearch(val);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            if (search) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all font-medium disabled:bg-gray-100 disabled:cursor-not-allowed"
          autoComplete="off"
        />
        {(selectedOption || search) ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
            title="Clear"
            disabled={disabled}
          >
            <X size={16} />
          </button>
        ) : (
          <ChevronDown
            size={18}
            className="absolute right-3 text-gray-400 pointer-events-none"
          />
        )}
      </div>

      {/* Dropdown list */}
      {isOpen && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-60 overflow-y-auto"
        >
          {filtered.map((opt, idx) => (
            <div
              key={opt.value + '-' + idx}
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-3 py-2 cursor-pointer text-sm ${
                highlightedIndex === idx
                  ? 'bg-blue-100 text-blue-900'
                  : 'hover:bg-gray-50 text-gray-800'
              }`}
            >
              <div className="font-medium">{renderHighlighted(opt.label)}</div>
              {opt.sub && (
                <div className="text-xs text-gray-500">{opt.sub}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && search && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-sm z-30 px-3 py-2 text-sm text-gray-500">
          No results matching &quot;{search}&quot;
        </div>
      )}
    </div>
  );
}
