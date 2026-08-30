import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, CheckSquare, Square, MinusSquare, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * EntityFilterPanel provides dynamic entity selection (departments, parties, items, etc.)
 * with "Select All", search filter, and individual checkboxes.
 */
const EntityFilterPanel = ({
  filterType,
  filterLabel = 'Item',
  fromDate,
  toDate,
  selectedIds = [],
  onChange
}) => {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchEntities = async () => {
    if (!filterType) return;
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`${API_URL}/reports/filters/${filterType}`, {
        params: { fromDate, toDate }
      });
      if (res.data?.success) {
        const list = res.data.data || [];
        setEntities(list);
        // By default, select all available entities
        const allIds = list.map(e => e.id);
        onChange(allIds, true);
      } else {
        setError(res.data?.message || 'Failed to load filter options');
      }
    } catch (err) {
      console.error(`Error loading filter options for ${filterType}:`, err);
      setError(err.response?.data?.message || 'Error loading options from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntities();
  }, [filterType, fromDate, toDate]);

  // Filtered entities based on search input
  const filteredEntities = useMemo(() => {
    if (!searchTerm.trim()) return entities;
    const term = searchTerm.toLowerCase();
    return entities.filter(e => e.name.toLowerCase().includes(term) || String(e.id).toLowerCase().includes(term));
  }, [entities, searchTerm]);

  // Check state
  const isAllSelected = entities.length > 0 && selectedIds.length === entities.length;
  const isNoneSelected = selectedIds.length === 0;
  const isIndeterminate = !isAllSelected && !isNoneSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      onChange([], false);
    } else {
      const allIds = entities.map(e => e.id);
      onChange(allIds, true);
    }
  };

  const handleToggleEntity = (id) => {
    const exists = selectedIds.includes(id);
    let updated;
    if (exists) {
      updated = selectedIds.filter(item => item !== id);
    } else {
      updated = [...selectedIds, id];
    }
    onChange(updated, updated.length === entities.length);
  };

  if (!filterType) return null;

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 mt-4 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Filter by {filterLabel}:
          </label>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
            {isAllSelected ? `All ${entities.length} Selected` : `${selectedIds.length} of ${entities.length} Selected`}
          </span>
        </div>

        {/* Quick Search */}
        <div className="relative min-w-[200px] sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${filterLabel.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
          <Loader2 size={16} className="animate-spin text-indigo-600" />
          Loading available {filterLabel.toLowerCase()}s...
        </div>
      ) : error ? (
        <div className="py-3 px-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchEntities}
            className="flex items-center gap-1 font-semibold text-rose-800 hover:underline cursor-pointer"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      ) : entities.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400 italic">
          No {filterLabel.toLowerCase()}s found for this period.
        </div>
      ) : (
        <div>
          {/* Master Select All Toggle */}
          <div className="flex items-center justify-between py-1.5 px-2 mb-2 bg-white/80 border-b border-slate-200 rounded-md">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-indigo-600 cursor-pointer select-none"
            >
              {isAllSelected ? (
                <CheckSquare size={16} className="text-indigo-600 fill-indigo-50" />
              ) : isIndeterminate ? (
                <MinusSquare size={16} className="text-indigo-500" />
              ) : (
                <Square size={16} className="text-slate-400" />
              )}
              <span>Select All {filterLabel}s ({entities.length})</span>
            </button>

            {selectedIds.length > 0 && !isAllSelected && (
              <button
                type="button"
                onClick={() => onChange([], false)}
                className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 cursor-pointer"
              >
                Clear Selection
              </button>
            )}
          </div>

          {/* Checkbox List Grid */}
          <div className="max-h-48 overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 p-1">
            {filteredEntities.map((entity) => {
              const isChecked = selectedIds.includes(entity.id);
              return (
                <label
                  key={entity.id}
                  className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium cursor-pointer transition-all border select-none ${
                    isChecked
                      ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/80 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleEntity(entity.id)}
                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="truncate" title={entity.name}>
                    {entity.name}
                  </span>
                </label>
              );
            })}
          </div>
          {filteredEntities.length === 0 && (
            <p className="text-center py-3 text-xs text-slate-400 italic">
              No matching {filterLabel.toLowerCase()}s found for "{searchTerm}"
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default EntityFilterPanel;
