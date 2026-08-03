// frontend/src/components/ui/PageHeader.jsx
import { ArrowLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  backPath,
  backText,
  actionText,
  onActionClick
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {backPath && (
        <button
          onClick={() => navigate(backPath)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium text-sm cursor-pointer transition-colors"
        >
          <ArrowLeft size={16} />
          <span>{backText}</span>
        </button>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 flex-shrink-0">
              <Icon className="w-6 h-6 stroke-[2.2]" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          </div>
        </div>

        {actionText && onActionClick && (
          <button
            onClick={onActionClick}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-indigo-500/25 transition-all transform hover:scale-105 flex items-center gap-2 text-sm font-semibold cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            {actionText}
          </button>
        )}
      </div>
    </div>
  );
}
