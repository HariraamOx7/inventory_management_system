// frontend/src/components/PurchaseTypeModal.jsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Save, X, AlertCircle } from 'lucide-react';

const DETAIL_VARIABLES = [
  '[TotalAmount]',
  '[DiscountAmount]',
  '[DutyAmount]',
  '[CSTAmount]',
  '[TaxAmount]',
  '[PFAmount]',
  '[LorryFreight]',
  '[Roundoff]',
  '[GrandTotal]',
  '[TCS]'
];

const API_URL = import.meta.env.VITE_API_URL || 'https://krexports.org/krest';

const initialPTFormState = {
  Code: '',
  PurchaseType: '',
  Description: '',
  AssessValue: '[TotalAmount]-[DiscountAmount]+[PFAmount]+[LorryFreight]',
  RoundOff: '[RoundOff]',
  Duty1: '',
  Commodity: '',
  TDS: '',
  LorryFreight: '[PFAmount]+[LorryFreightN]',
  SGST: '[SGST]',
  SGSTLedger: 'INPUT SGST 9%',
  CGST: '[CGST]',
  CGSTLedger: 'INPUT CGST 9%',
  IGST: '[IGST]',
  IGSTLedger: 'INPUT IGST 18%',
  TCS: '[TCS]',
  TCSLedger: 'TAX COLLECTED AT SOURCE (T.C.S PAID)'
};

export { initialPTFormState };

export default function PurchaseTypeModal({ isOpen, onClose, onSaved, editData }) {
  const [ptForm, setPtForm] = useState(initialPTFormState);
  const [defaultFormulas, setDefaultFormulas] = useState({});
  const [saving, setSaving] = useState(false);
  const [ptError, setPtError] = useState('');

  const isEditing = !!editData;

  const assessValueRef = useRef(null);
  const lorryFreightRef = useRef(null);

  const [activeField, setActiveField] = useState(null); // 'AssessValue' or 'LorryFreight'
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleFormulaKeyDown = (e) => {
    // Prevent standard alphabetical typing, but allow operators, spaces, numbers, backspaces, and editing keys
    if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
    }
  };

  const handleFieldSelect = (fieldName, e) => {
    setActiveField(fieldName);
    setCursorPosition(e.target.selectionStart || 0);
  };

  const handleDetailClick = (variableName) => {
    if (!activeField) return;

    const currentVal = ptForm[activeField] || '';
    const start = cursorPosition;
    const newVal = currentVal.substring(0, start) + variableName + currentVal.substring(start);

    setPtForm(prev => ({ ...prev, [activeField]: newVal }));

    const newPos = start + variableName.length;
    setCursorPosition(newPos);

    const ref = activeField === 'AssessValue' ? assessValueRef : lorryFreightRef;
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        ref.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const getFormulaValidationError = (val) => {
    if (!val) return '';
    // Adjacent variables (e.g. [A][B] or [A] [B])
    if (/\]\s*\[/.test(val)) {
      return 'Please enter a valid operation symbol between variables.';
    }
    // Variable next to alphanumeric characters
    if (/\]\s*[0-9a-zA-Z]/.test(val) || /[0-9a-zA-Z]\s*\[/.test(val)) {
      return 'Please enter a valid operation symbol between variables/numbers.';
    }
    return '';
  };

  const assessValueError = getFormulaValidationError(ptForm.AssessValue);
  const lorryFreightError = getFormulaValidationError(ptForm.LorryFreight);

  useEffect(() => {
    if (isOpen) {
      setPtError('');
      if (editData) {
        setPtForm({
          Code: editData.Code || '',
          PurchaseType: editData.PurchaseType || '',
          Description: editData.Description || '',
          AssessValue: editData.AssessValue || '',
          RoundOff: editData.RoundOff || '',
          Duty1: editData.Duty1 || '',
          Commodity: editData.Commodity || '',
          TDS: editData.TDS || '',
          LorryFreight: editData.LorryFreight || '',
          SGST: editData.SGST || '',
          SGSTLedger: editData.SGSTLedger || '',
          CGST: editData.CGST || '',
          CGSTLedger: editData.CGSTLedger || '',
          IGST: editData.IGST || '',
          IGSTLedger: editData.IGSTLedger || '',
          TCS: editData.TCS || '',
          TCSLedger: editData.TCSLedger || ''
        });
      } else {
        // Fetch next code for new entries
        const fetchNextCode = async () => {
          try {
            const res = await axios.get(`${API_URL}/purchase-types/next-code`);
            if (res.data.success) {
              setPtForm({ ...initialPTFormState, Code: res.data.data.nextCode });
            }
          } catch (err) {
            console.error('Error fetching next code:', err);
            setPtForm({ ...initialPTFormState });
          }
        };
        fetchNextCode();
      }

      // Fetch default formulas
      const fetchDefaults = async () => {
        try {
          const res = await axios.get(`${API_URL}/purchase-types/default-formulas`);
          if (res.data.success) {
            setDefaultFormulas(res.data.data);
          }
        } catch (err) {
          console.error('Error fetching default formulas:', err);
        }
      };
      fetchDefaults();
    }
  }, [isOpen, editData]);

  const handleResetFormulas = () => {
    setPtForm(prev => ({
      ...prev,
      AssessValue: defaultFormulas.AssessValue || initialPTFormState.AssessValue,
      RoundOff: defaultFormulas.RoundOff || initialPTFormState.RoundOff,
      LorryFreight: defaultFormulas.LorryFreight || initialPTFormState.LorryFreight,
      SGST: defaultFormulas.SGST || initialPTFormState.SGST,
      CGST: defaultFormulas.CGST || initialPTFormState.CGST,
      IGST: defaultFormulas.IGST || initialPTFormState.IGST,
      TCS: defaultFormulas.TCS || initialPTFormState.TCS
    }));
  };

  const handleSavePT = async () => {
    if (!ptForm.PurchaseType.trim()) {
      setPtError('Purchase Type name is required');
      return;
    }

    try {
      setSaving(true);
      setPtError('');

      if (isEditing) {
        const res = await axios.put(`${API_URL}/purchase-types/${ptForm.Code}`, ptForm);
        if (res.data.success) {
          onSaved(res.data.data);
        }
      } else {
        const res = await axios.post(`${API_URL}/purchase-types`, ptForm);
        if (res.data.success) {
          onSaved(res.data.data);
        }
      }
    } catch (err) {
      setPtError(err.response?.data?.message || 'Error saving purchase type');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden mx-4 flex flex-col border-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">
              {isEditing ? 'Edit Purchase Type' : 'Add Purchase Type'}
            </h2>
            <p className="text-blue-100 text-sm mt-0.5">
              {isEditing ? 'Modify purchase type details.' : 'To Add, Modify purchase type details.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-all"
          >
            <X size={22} />
          </button>
        </div>

        {/* Error */}
        {ptError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} />
            {ptError}
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Form Content */}
          <div className="flex-1 p-6 overflow-y-auto border-r border-gray-100">
            {/* Row 1: Code + Purchase Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Code</label>
                <input
                  type="number"
                  onWheel={(e) => e.target.blur()}
                  value={ptForm.Code}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Purchase Type <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={ptForm.PurchaseType}
                  onChange={(e) => setPtForm({ ...ptForm, PurchaseType: e.target.value })}
                  placeholder="e.g. PURCHASE SPARES PURCHASE GST 18%"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Row 2: Assess Value + Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Assess. Value
                  <span className="ml-1 text-xs text-blue-500 font-normal">(formula)</span>
                </label>
                <input
                  type="text"
                  ref={assessValueRef}
                  value={ptForm.AssessValue}
                  onChange={(e) => setPtForm({ ...ptForm, AssessValue: e.target.value })}
                  onKeyDown={handleFormulaKeyDown}
                  onSelect={(e) => handleFieldSelect('AssessValue', e)}
                  onFocus={(e) => handleFieldSelect('AssessValue', e)}
                  placeholder="[TotalAmount]-[DiscountAmount]"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                {assessValueError && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle size={12} />
                    {assessValueError}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={ptForm.Description}
                  onChange={(e) => setPtForm({ ...ptForm, Description: e.target.value })}
                  placeholder="e.g. SPARES PURCHASE"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 3: Round Off */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Round Off
                  <span className="ml-1 text-xs text-blue-500 font-normal">(formula)</span>
                </label>
                <input
                  type="text"
                  value={ptForm.RoundOff}
                  onChange={(e) => setPtForm({ ...ptForm, RoundOff: e.target.value })}
                  placeholder="[RoundOff]"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div className="flex items-end">
                <span className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm font-medium w-full text-center">
                  ROUND OFF
                </span>
              </div>
            </div>

            {/* Row 4: Duty 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Duty 1</label>
                <input
                  type="text"
                  value={ptForm.Duty1}
                  onChange={(e) => setPtForm({ ...ptForm, Duty1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 5: Commodity + TDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Commodity</label>
                <input
                  type="text"
                  value={ptForm.Commodity}
                  onChange={(e) => setPtForm({ ...ptForm, Commodity: e.target.value })}
                  placeholder="e.g. INDUSTRIAL INPUT"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">TDS</label>
                <input
                  type="text"
                  value={ptForm.TDS}
                  onChange={(e) => setPtForm({ ...ptForm, TDS: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 6: Lorry Freight */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Lorry Freight
                  <span className="ml-1 text-xs text-blue-500 font-normal">(formula)</span>
                </label>
                <input
                  type="text"
                  ref={lorryFreightRef}
                  value={ptForm.LorryFreight}
                  onChange={(e) => setPtForm({ ...ptForm, LorryFreight: e.target.value })}
                  onKeyDown={handleFormulaKeyDown}
                  onSelect={(e) => handleFieldSelect('LorryFreight', e)}
                  onFocus={(e) => handleFieldSelect('LorryFreight', e)}
                  placeholder="[PFAmount]+[LorryFreightN]"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                {lorryFreightError && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle size={12} />
                    {lorryFreightError}
                  </p>
                )}
              </div>
              <div className="flex items-end">
                <span className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm font-medium w-full text-center">
                  FREIGHT &amp; CARTAGE
                </span>
              </div>
            </div>

            {/* Divider — Tax Section */}
            <div className="border-t border-gray-200 my-5 pt-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">
                Tax Details
              </h3>
            </div>

            {/* SGST + Ledger */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  SGST
                </label>
                <input
                  type="text"
                  value={ptForm.SGST}
                  onChange={(e) => setPtForm({ ...ptForm, SGST: e.target.value })}
                  placeholder="[SGST]"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">SGST Ledger</label>
                <input
                  type="text"
                  value={ptForm.SGSTLedger}
                  onChange={(e) => setPtForm({ ...ptForm, SGSTLedger: e.target.value })}
                  placeholder="e.g. INPUT SGST 9%"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* CGST + Ledger */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  CGST
                </label>
                <input
                  type="text"
                  value={ptForm.CGST}
                  onChange={(e) => setPtForm({ ...ptForm, CGST: e.target.value })}
                  placeholder="[CGST]"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">CGST Ledger</label>
                <input
                  type="text"
                  value={ptForm.CGSTLedger}
                  onChange={(e) => setPtForm({ ...ptForm, CGSTLedger: e.target.value })}
                  placeholder="e.g. INPUT CGST 9%"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* IGST + Ledger */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  IGST
                </label>
                <input
                  type="text"
                  value={ptForm.IGST}
                  onChange={(e) => setPtForm({ ...ptForm, IGST: e.target.value })}
                  placeholder="[IGST]"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">IGST Ledger</label>
                <input
                  type="text"
                  value={ptForm.IGSTLedger}
                  onChange={(e) => setPtForm({ ...ptForm, IGSTLedger: e.target.value })}
                  placeholder="e.g. INPUT IGST 18%"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* TCS + Ledger */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  TCS
                  <span className="ml-1 text-xs text-blue-500 font-normal">(formula)</span>
                </label>
                <input
                  type="text"
                  value={ptForm.TCS}
                  onChange={(e) => setPtForm({ ...ptForm, TCS: e.target.value })}
                  placeholder="[TCS]"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">TCS Ledger</label>
                <input
                  type="text"
                  value={ptForm.TCSLedger}
                  onChange={(e) => setPtForm({ ...ptForm, TCSLedger: e.target.value })}
                  placeholder="e.g. TAX COLLECTED AT SOURCE"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Details Sidebar */}
          <div className="w-64 bg-slate-50 p-6 overflow-y-auto flex flex-col shrink-0">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
              Details List
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Click a variable to insert it at your cursor in a formula field.
            </p>
            <div className="space-y-2">
              {DETAIL_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleDetailClick(v)}
                  className="w-full text-left px-3 py-2 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-mono text-sm rounded-lg border border-slate-200 hover:border-blue-300 transition-all shadow-sm flex items-center justify-between group"
                >
                  <span>{v}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-700 px-1.5 py-0.5 rounded transition-all">
                    Insert
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-all"
          >
            <X size={16} />
            Cancel
          </button>
          <button
            onClick={handleSavePT}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2 transition-all shadow-sm"
          >
            <Save size={16} />
            {saving ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
