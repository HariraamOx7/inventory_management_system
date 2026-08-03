// frontend/src/components/ui/FilterPanel.jsx
import { Search, X, ArrowUpDown } from 'lucide-react';
import CustomSelect from '../CustomSelect';

export default function FilterPanel({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  sortOptions = [],
  sortBy,
  onSortChange
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
      {/* Full Width Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
        />
        {search && (
          <button 
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter & Sort Controls Row */}
      {(filters.length > 0 || sortOptions.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {filters.map((filter, index) => (
            <CustomSelect
              key={filter.label || index}
              label={filter.label}
              icon={filter.icon}
              value={filter.value}
              onChange={(val) => {
                if (typeof filter.onChange === 'function') {
                  const cleanVal = val && val.target ? val.target.value : val;
                  filter.onChange(cleanVal);
                }
              }}
              options={filter.options}
              searchable={filter.searchable}
            />
          ))}

          {sortOptions.length > 0 && (
            <CustomSelect
              label="Sort By"
              icon={ArrowUpDown}
              value={sortBy}
              onChange={(val) => {
                const cleanVal = val && val.target ? val.target.value : val;
                if (typeof onSortChange === 'function') onSortChange(cleanVal);
              }}
              options={sortOptions}
            />
          )}
        </div>
      )}
    </div>
  );
}
