import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export default function CustomSelect({
    value,
    onChange,
    options,
    placeholder = 'Select option',
    label,
    icon: Icon,
    required = false,
    searchable = false,
    searchPlaceholder = 'Search...'
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    // Normalize options to [{ value, label }]
    const normalizedOptions = (options || []).map(opt => {
        if (typeof opt === 'object' && opt !== null) {
            const val = opt.value !== undefined ? opt.value : (opt.dept_id !== undefined ? opt.dept_id : (opt.code !== undefined ? opt.code : (opt.id !== undefined ? opt.id : opt.uom)));
            const lbl = opt.label !== undefined && opt.label !== null ? String(opt.label) : (opt.name !== undefined ? String(opt.name) : (opt.dept_name !== undefined ? String(opt.dept_name) : (opt.sub_group_name !== undefined ? String(opt.sub_group_name) : (opt.uom !== undefined ? String(opt.uom) : String(val ?? '')))));
            return { value: val, label: lbl };
        }
        return { value: opt, label: String(opt ?? '') };
    });

    const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value));

    // Handle click outside to close
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter options based on search term safely
    const filteredOptions = normalizedOptions.filter(opt =>
        String(opt.label || '').toLowerCase().includes(String(searchTerm || '').toLowerCase())
    );

    const hasAsterisk = typeof label === 'string' && /\*\s*$/.test(label);
    const cleanLabel = typeof label === 'string' ? label.replace(/\s*\*+\s*$/, '') : label;
    const showRequired = required || hasAsterisk;

    return (
        <div className="relative w-full" ref={containerRef}>
            {label && (
                <label className="block text-base font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    {Icon && <Icon className="w-4 h-4 text-blue-500" />}
                    <span>{cleanLabel}</span>
                    {showRequired && <span className="text-red-500 font-bold ml-0.5">*</span>}
                </label>
            )}

            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    setSearchTerm('');
                }}
                className="w-full min-h-[46px] flex items-center justify-between px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-left shadow-2xs hover:border-slate-400 cursor-pointer"
            >
                <span className={`truncate ${selectedOption ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ml-2 flex-shrink-0 ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu Popover */}
            {isOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 flex flex-col overflow-hidden">
                    {searchable && (
                        <div className="p-2.5 border-b border-slate-100 relative flex-shrink-0">
                            <Search className="w-4 h-4 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                autoFocus
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="overflow-y-auto custom-scrollbar py-1.5 flex-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => {
                                const isSelected = String(opt.value) === String(value);
                                return (
                                    <button
                                        key={String(opt.value)}
                                        type="button"
                                        onClick={() => {
                                            onChange(opt.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-base transition-colors hover:bg-blue-50/70 ${isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="px-4 py-3 text-sm text-slate-400 text-center">
                                No options match search
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
