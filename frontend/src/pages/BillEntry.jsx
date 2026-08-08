// frontend/src/pages/BillEntry.jsx
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import {
  Plus, Edit2, Trash2, Save, X, FileText, ArrowUpDown, Receipt as ReceiptIcon,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Inbox, Printer
} from 'lucide-react';
import Layout from '../components/Layout';
import SearchSelect from '../components/SearchSelect';
import CustomSelect from '../components/CustomSelect';
import PageHeader from '../components/ui/PageHeader';
import FilterPanel from '../components/ui/FilterPanel';
import { useToastStore } from '../store/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const formatRoundOff = (val) => {
  const num = parseFloat(val) || 0;
  if (num > 0) return `+${num.toFixed(2)}`;
  return num.toFixed(2);
};

const initialFormState = {
  VoucherNo: '',
  GateInwardNo: '',
  GRNNo: '',
  PartyName: '',
  AccDate: new Date().toISOString().split('T')[0],
  PartyBillNo: '',
  BillDate: new Date().toISOString().split('T')[0],
  PurchaseType: '',
  BillAmount: 0,
  TDS: 0,
  Narration: '',
  Total: 0,
  Discount: 0,
  GST: 0,
  IGST: 0,
  VAT_CST: 0,
  P_F: 0,
  LorryFreight: 0,
  RoundOff: 0,
  TaxRndOff: 0,
  GrandTotal: 0
};

export default function BillEntry() {
  const showToast = useToastStore(state => state.showToast);

  const [formData, setFormData] = useState(initialFormState);
  const [parties, setParties] = useState([]);
  const [gateInwardsList, setGateInwardsList] = useState([]);
  const [grnsList, setGrnsList] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [billEntries, setBillEntries] = useState([]);
  const [editingVoucherNo, setEditingVoucherNo] = useState(null);
  const [purchaseTypes, setPurchaseTypes] = useState([]);

  // Slide-over Drawer states (Matching Item Master style)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isNewEntry, setIsNewEntry] = useState(false);

  // Filters & Sorting state
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchBillEntries = async () => {
    try {
      const billsRes = await axios.get(`${API_URL}/bill-entries`);
      if (billsRes.data?.success) {
        setBillEntries(billsRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching bill entries:', error);
    }
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      await fetchBillEntries();

      const [ptRes, partiesRes] = await Promise.all([
        axios.get(`${API_URL}/purchase-types`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_URL}/bill-entries/available-parties`).catch(() => ({ data: { success: false } }))
      ]);

      if (ptRes.data?.success) {
        setPurchaseTypes(ptRes.data.data);
      }

      if (partiesRes.data?.success) {
        setParties((partiesRes.data.data || []).map(name => ({ name })));
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch available Gate Inwards and GRNs when party is selected in form
  useEffect(() => {
    if (formData.PartyName) {
      const fetchPartyDropdowns = async () => {
        try {
          const [inwardRes, grnRes] = await Promise.all([
            axios.get(`${API_URL}/bill-entries/available-gate-inwards`, {
              params: { partyName: formData.PartyName }
            }).catch(() => ({ data: { success: false } })),
            axios.get(`${API_URL}/bill-entries/available-grns`, {
              params: {
                partyName: formData.PartyName,
                ...(formData.GateInwardNo ? { gateInwardNo: formData.GateInwardNo } : {})
              }
            }).catch(() => ({ data: { success: false } }))
          ]);

          if (inwardRes.data?.success) {
            setGateInwardsList(inwardRes.data.data || []);
          }
          if (grnRes.data?.success) {
            setGrnsList(grnRes.data.data || []);
          }
        } catch (error) {
          console.error('Error fetching Gate Inwards & GRNs for party:', error);
        }
      };

      fetchPartyDropdowns();
    } else {
      setGateInwardsList([]);
      setGrnsList([]);
    }
  }, [formData.PartyName, formData.GateInwardNo]);

  // Fetch GRN details when GRNNo changes in form (only for new entries)
  useEffect(() => {
    if (formData.GRNNo && isNewEntry) {
      const fetchGRNDetails = async () => {
        try {
          const response = await axios.get(`${API_URL}/bill-entries/grn-details`, {
            params: { grnNo: formData.GRNNo }
          });
          if (response.data?.success) {
            const receipt = response.data.data;
            setFormData(prev => ({
              ...prev,
              GateInwardNo: receipt.GateInwardNo || prev.GateInwardNo,
              PartyName: receipt.PartyName || prev.PartyName,
              PartyBillNo: receipt.InvoiceNo || prev.PartyBillNo,
              Total: receipt.Total || 0,
              Discount: receipt.Discount || 0,
              GST: receipt.GST || 0,
              IGST: receipt.IGST || 0,
              VAT_CST: receipt.VAT_CST || 0,
              P_F: receipt.P_F || 0,
              LorryFreight: receipt.LorryFreight || 0,
              RoundOff: receipt.RoundOff || 0,
              GrandTotal: receipt.GrandTotal || 0,
              BillAmount: receipt.GrandTotal || 0
            }));

            const details = receipt.details || receipt.ReceiptDetails || [];
            if (details.length > 0) {
              setItems(details.map(d => {
                const qtyVal = d.Qty !== undefined ? d.Qty : (d.ReceivedQty !== undefined ? d.ReceivedQty : 0);
                return {
                  ItemName: d.ItemName,
                  ReceivedQty: qtyVal,
                  Qty: qtyVal,
                  UnitRate: d.UnitRate || 0,
                  OrderNo: d.OrderNo
                };
              }));
            }
          }
        } catch (error) {
          console.error('Error fetching GRN details:', error);
        }
      };
      fetchGRNDetails();
    }
  }, [formData.GRNNo, isNewEntry]);

  // Recalculate Total from items
  useEffect(() => {
    if (items.length > 0) {
      const calculatedTotal = items.reduce((sum, item) => {
        const qty = parseFloat(item.ReceivedQty !== undefined ? item.ReceivedQty : item.Qty) || 0;
        const rate = parseFloat(item.UnitRate) || 0;
        return sum + (qty * rate);
      }, 0);
      setFormData(prev => {
        if (prev.Total === calculatedTotal) return prev;
        return { ...prev, Total: calculatedTotal };
      });
    }
  }, [items]);

  // Recalculate Grand Total
  useEffect(() => {
    const total = parseFloat(formData.Total) || 0;
    const discount = parseFloat(formData.Discount) || 0;
    const gst = parseFloat(formData.GST) || 0;
    const igst = parseFloat(formData.IGST) || 0;
    const vatCst = parseFloat(formData.VAT_CST) || 0;
    const pf = parseFloat(formData.P_F) || 0;
    const lorryFreight = parseFloat(formData.LorryFreight) || 0;
    const unroundedGrandTotal = total - discount + gst + igst + vatCst + pf + lorryFreight;
    const computedGrandTotal = Math.round(unroundedGrandTotal);
    const computedRoundOff = parseFloat((computedGrandTotal - unroundedGrandTotal).toFixed(2));

    setFormData(prev => {
      if (prev.GrandTotal === computedGrandTotal && prev.RoundOff === computedRoundOff && prev.BillAmount === computedGrandTotal) return prev;
      return {
        ...prev,
        GrandTotal: computedGrandTotal,
        RoundOff: computedRoundOff,
        BillAmount: computedGrandTotal
      };
    });
  }, [formData.Total, formData.Discount, formData.GST, formData.IGST, formData.VAT_CST, formData.P_F, formData.LorryFreight]);

  // Unique parties from existing bill entries (for filter dropdown)
  const uniqueBillParties = useMemo(() => {
    const setP = new Set();
    billEntries.forEach(b => { if (b.PartyName) setP.add(b.PartyName); });
    return Array.from(setP).sort();
  }, [billEntries]);

  // Filtered & Sorted Bill Entries
  const filteredAndSortedBills = useMemo(() => {
    return billEntries
      .filter(b => {
        const matchSearch = search.trim() === '' ||
          String(b.VoucherNo).toLowerCase().includes(search.toLowerCase()) ||
          String(b.GRNNo).toLowerCase().includes(search.toLowerCase()) ||
          String(b.GateInwardNo).toLowerCase().includes(search.toLowerCase()) ||
          (b.PartyName && b.PartyName.toLowerCase().includes(search.toLowerCase())) ||
          (b.PartyBillNo && b.PartyBillNo.toLowerCase().includes(search.toLowerCase()));
        const matchParty = partyFilter === 'ALL' || b.PartyName === partyFilter;
        return matchSearch && matchParty;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.AccDate || b.createdAt) - new Date(a.AccDate || a.createdAt);
        }
        if (sortBy === 'oldest') {
          return new Date(a.AccDate || a.createdAt) - new Date(b.AccDate || b.createdAt);
        }
        if (sortBy === 'voucher_desc') {
          return Number(b.VoucherNo) - Number(a.VoucherNo);
        }
        if (sortBy === 'voucher_asc') {
          return Number(a.VoucherNo) - Number(b.VoucherNo);
        }
        if (sortBy === 'total_desc') {
          return (b.GrandTotal || 0) - (a.GrandTotal || 0);
        }
        return 0;
      });
  }, [billEntries, search, partyFilter, sortBy]);

  // Pagination calculations
  const totalItems = filteredAndSortedBills.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedBills.slice(start, start + itemsPerPage);
  }, [filteredAndSortedBills, currentPage, itemsPerPage]);

  const handleOpenAddDrawer = () => {
    setIsNewEntry(true);
    setEditingVoucherNo(null);
    setFormData(initialFormState);
    setItems([]);
    setGateInwardsList([]);
    setGrnsList([]);
    // Refresh parties list and purchase types
    axios.get(`${API_URL}/bill-entries/available-parties`)
      .then(res => { if (res.data?.success) setParties((res.data.data || []).map(n => ({ name: n }))); })
      .catch(() => { });
    axios.get(`${API_URL}/purchase-types`)
      .then(res => { if (res.data?.success) setPurchaseTypes(res.data.data); })
      .catch(() => { });
    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 10);
  };

  const handleOpenEditDrawer = (bill) => {
    setIsNewEntry(false);
    setFormData({
      VoucherNo: bill.VoucherNo.toString(),
      GateInwardNo: bill.GateInwardNo || '',
      GRNNo: bill.GRNNo || '',
      PartyName: bill.PartyName || '',
      AccDate: bill.AccDate ? new Date(bill.AccDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      PartyBillNo: bill.PartyBillNo || '',
      BillDate: bill.BillDate ? new Date(bill.BillDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      PurchaseType: bill.PurchaseType || '',
      BillAmount: bill.BillAmount || 0,
      TDS: bill.TDS || 0,
      Narration: bill.Narration || '',
      Total: bill.Total || 0,
      Discount: bill.Discount || 0,
      GST: bill.GST || 0,
      IGST: bill.IGST || 0,
      VAT_CST: bill.VAT_CST || 0,
      P_F: bill.P_F || 0,
      RoundOff: bill.RoundOff || 0,
      TaxRndOff: bill.TaxRndOff || 0,
      GrandTotal: bill.GrandTotal || 0
    });

    const details = bill.details || bill.BillEntryDetails || [];
    if (details.length > 0) {
      setItems(details.map(d => {
        const qtyVal = d.Qty !== undefined ? d.Qty : (d.ReceivedQty !== undefined ? d.ReceivedQty : 0);
        return {
          ItemName: d.ItemName,
          ReceivedQty: qtyVal,
          Qty: qtyVal,
          UnitRate: d.UnitRate || 0,
          OrderNo: d.OrderNo
        };
      }));
    } else {
      setItems([]);
    }

    setEditingVoucherNo(bill.VoucherNo);
    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 10);
  };

  const handleCloseEditDrawer = () => {
    setIsDrawerVisible(false);
    setTimeout(() => {
      setEditDrawerOpen(false);
      setEditingVoucherNo(null);
      setFormData(initialFormState);
      setItems([]);
    }, 300);
  };

  const handleDelete = async (voucherNo) => {
    if (!window.confirm(`Are you sure you want to delete Bill Entry #${voucherNo}?`)) return;
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/bill-entries/${voucherNo}`);
      fetchBillEntries();
    } catch (error) {
      console.error('Error deleting bill entry:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper: run layered deletion confirmation for a duplicate bill entry chain
  const handleDuplicateBillCleanup = async (duplicate, payload) => {
    const { VoucherNo, PartyName: dupParty, PartyBillNo: dupBillNo, GRNNo, GateInwardNo, hasReceipt, hasGateInward, hasPurchaseOrder } = duplicate;

    // Layer 1: Confirm BillEntry deletion
    const confirmBill = window.confirm(
      `⚠️ DUPLICATE BILL ENTRY FOUND\n\n` +
      `Party: ${dupParty}\nBill No: ${dupBillNo}\nVoucher No: ${VoucherNo}\n\n` +
      `Do you want to DELETE this duplicate bill entry (#${VoucherNo}) to proceed?`
    );
    if (!confirmBill) {
      showToast('Save cancelled — duplicate bill entry was not removed.', 'warning');
      return false;
    }

    const layers = { bill: true, receipt: false, gateInward: false, purchaseOrder: false };

    // Layer 2: Confirm Receipt deletion
    if (hasReceipt && GRNNo) {
      layers.receipt = window.confirm(
        `Also DELETE the linked Receipt/GRN (GRN #${GRNNo}) and its item details?`
      );
    }

    // Layer 3: Confirm GateInward deletion
    if (hasGateInward && GateInwardNo) {
      layers.gateInward = window.confirm(
        `Also DELETE the linked Gate Inward (#${GateInwardNo}) and its item details?`
      );
    }

    // Layer 4: Confirm PurchaseOrder deletion
    if (hasPurchaseOrder && layers.gateInward) {
      layers.purchaseOrder = window.confirm(
        `Also DELETE the linked Purchase Order (Order #${duplicate.OrderNo}) and its item details?\n\n(Will be skipped if another Gate Inward references the same PO.)`
      );
    }

    // Execute cascade delete
    try {
      await axios.delete(`${API_URL}/bill-entries/delete-chain/${VoucherNo}`, { data: { layers } });
      showToast(`Duplicate bill entry #${VoucherNo} and selected linked records removed.`, 'success');
      return true;
    } catch (deleteErr) {
      console.error('Error deleting duplicate chain:', deleteErr);
      showToast(deleteErr.response?.data?.message || 'Failed to delete duplicate records.', 'error');
      return false;
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.PartyName) {
      alert('Please select Party Name');
      return;
    }
    if (!formData.GRNNo) {
      alert('Please select a GRN No');
      return;
    }

    const payload = {
      ...formData,
      items: items.map(item => {
        const qty = parseFloat(item.ReceivedQty !== undefined ? item.ReceivedQty : item.Qty) || 0;
        const rate = parseFloat(item.UnitRate) || 0;
        return {
          ItemName: item.ItemName,
          Qty: qty,
          ReceivedQty: qty,
          UnitRate: rate,
          TotalAmount: qty * rate
        };
      })
    };

    try {
      setLoading(true);
      if (editingVoucherNo) {
        await axios.put(`${API_URL}/bill-entries/${editingVoucherNo}`, payload);
        showToast('Bill entry updated successfully!', 'success');
        handleCloseEditDrawer();
        fetchBillEntries();
      } else {
        try {
          await axios.post(`${API_URL}/bill-entries`, payload);
          showToast('Bill entry created successfully!', 'success');
          handleCloseEditDrawer();
          fetchBillEntries();
        } catch (createErr) {
          if (createErr.response?.status === 409 && createErr.response?.data?.duplicate) {
            // Duplicate detected — run layered confirmation flow
            setLoading(false);
            const cleaned = await handleDuplicateBillCleanup(createErr.response.data.duplicate, payload);
            if (cleaned) {
              // Re-attempt save after cleanup
              setLoading(true);
              await axios.post(`${API_URL}/bill-entries`, payload);
              showToast('Bill entry created successfully!', 'success');
              handleCloseEditDrawer();
              fetchBillEntries();
            }
            return;
          }
          throw createErr;
        }
      }
    } catch (error) {
      console.error('Error saving bill entry:', error);
      const msg = error.response?.data?.message || 'Error saving bill entry. Please check all fields and try again.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };


  const handlePrint = async (voucherNo) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/bill-entries/print-data/${voucherNo}`);
      if (!response.data?.success) {
        showToast('Error fetching print data', 'error');
        return;
      }
      const bill = response.data.data;
      generatePurchaseVoucherPDF(bill);
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('Error generating PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generatePurchaseVoucherPDF = (bill) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Helper functions
    const fmt = (num) => {
      const n = parseFloat(num) || 0;
      return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const drawLine = (yPos, x1 = margin, x2 = pageWidth - margin) => {
      doc.setLineWidth(0.3);
      doc.line(x1, yPos, x2, yPos);
    };

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Purchase Voucher', pageWidth / 2, y, { align: 'center' });
    // Underline title
    const titleWidth = doc.getTextWidth('Purchase Voucher');
    doc.setLineWidth(0.5);
    doc.line((pageWidth - titleWidth) / 2, y + 1, (pageWidth + titleWidth) / 2, y + 1);
    y += 10;

    // Vou.No. and Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Vou.No.   ${bill.VoucherNo}`, margin, y);
    const accDate = bill.AccDate ? new Date(bill.AccDate) : new Date();
    const dateStr = `${String(accDate.getDate()).padStart(2, '0')}-${String(accDate.getMonth() + 1).padStart(2, '0')}-${String(accDate.getFullYear()).slice(-2)}`;
    doc.text(`Date :   ${dateStr}`, pageWidth - margin - 50, y);
    y += 3;
    drawLine(y);
    y += 5;

    // Table header
    const col1X = margin;
    const col2X = margin + contentWidth * 0.6;
    const col3X = margin + contentWidth * 0.8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Description / Account Head', col1X, y);
    doc.text('Debit', col2X + 15, y, { align: 'right' });
    doc.text('Credit', col3X + 30, y, { align: 'right' });
    y += 2;
    drawLine(y);
    y += 6;

    // Debit entries
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let totalDebit = 0;
    let totalCredit = 0;

    // GST entries (SGST and CGST)
    const gstAmount = parseFloat(bill.GST) || 0;
    const itemsTotal = parseFloat(bill.Total) || 0;
    const discountAmt = parseFloat(bill.Discount) || 0;
    const pfAmt = parseFloat(bill.P_F) || 0;
    const lorryAmt = parseFloat(bill.LorryFreight) || 0;
    const baseForGst = itemsTotal - discountAmt + pfAmt + lorryAmt;

    if (gstAmount > 0) {
      const sgstAmt = bill.SGSTAmount || parseFloat((gstAmount / 2).toFixed(2));
      const cgstAmt = bill.CGSTAmount || parseFloat((gstAmount / 2).toFixed(2));
      let sgstPct = parseFloat(bill.SGSTPct) || 0;
      let cgstPct = parseFloat(bill.CGSTPct) || 0;

      if (!sgstPct && baseForGst > 0) {
        sgstPct = parseFloat(((sgstAmt / baseForGst) * 100).toFixed(2));
      }
      if (!cgstPct && baseForGst > 0) {
        cgstPct = parseFloat(((cgstAmt / baseForGst) * 100).toFixed(2));
      }

      const sgstStr = sgstPct > 0 ? ` ${sgstPct}%` : '';
      const cgstStr = cgstPct > 0 ? ` ${cgstPct}%` : '';

      const sgstLabel = `INPUT SGST${sgstStr}`;
      const cgstLabel = `INPUT CGST${cgstStr}`;

      doc.text(`    ${sgstLabel}`, col1X, y);
      doc.text(fmt(sgstAmt), col2X + 15, y, { align: 'right' });
      totalDebit += sgstAmt;
      y += 5;

      doc.text(`    ${cgstLabel}`, col1X, y);
      doc.text(fmt(cgstAmt), col2X + 15, y, { align: 'right' });
      totalDebit += cgstAmt;
      y += 5;
    }

    // IGST entry
    const igstAmount = parseFloat(bill.IGST) || 0;
    if (igstAmount > 0) {
      let igstPct = parseFloat(bill.IGSTPct) || 0;
      if (!igstPct && baseForGst > 0) {
        igstPct = parseFloat(((igstAmount / baseForGst) * 100).toFixed(2));
      }
      const igstStr = igstPct > 0 ? ` ${igstPct}%` : '';
      const igstLabel = `INPUT IGST${igstStr}`;
      doc.text(`    ${igstLabel}`, col1X, y);
      doc.text(fmt(igstAmount), col2X + 15, y, { align: 'right' });
      totalDebit += igstAmount;
      y += 5;
    }


    const purchaseLabel = bill.PurchaseType
      ? `    ${bill.PurchaseType.toUpperCase()}`
      : '    PURCHASE OF MATERIALS';
    const totalAmount = parseFloat(bill.Total) || 0;
    doc.text(purchaseLabel, col1X, y);
    doc.text(fmt(totalAmount), col2X + 15, y, { align: 'right' });
    totalDebit += totalAmount;
    y += 5;


    if (discountAmt > 0) {
      doc.text('    DISCOUNT', col1X, y);
      doc.text(fmt(discountAmt), col3X + 30, y, { align: 'right' });
      totalCredit += discountAmt;
      y += 5;
    }

    // VAT/CST
    const vatCstAmt = parseFloat(bill.VAT_CST) || 0;
    if (vatCstAmt > 0) {
      doc.text('    VAT / CST', col1X, y);
      doc.text(fmt(vatCstAmt), col2X + 15, y, { align: 'right' });
      totalDebit += vatCstAmt;
      y += 5;
    }

    // P&F
    if (pfAmt > 0) {
      doc.text('    PACKING & FORWARDING', col1X, y);
      doc.text(fmt(pfAmt), col2X + 15, y, { align: 'right' });
      totalDebit += pfAmt;
      y += 5;
    }

    // Lorry Freight
    if (lorryAmt > 0) {
      doc.text('    LORRY FREIGHT', col1X, y);
      doc.text(fmt(lorryAmt), col2X + 15, y, { align: 'right' });
      totalDebit += lorryAmt;
      y += 5;
    }

    // Party Name (Credit entry)
    doc.text(`To    ${bill.PartyName || ''}`, col1X, y);
    const grandTotal = parseFloat(bill.GrandTotal) || 0;
    doc.text(fmt(grandTotal), col3X + 30, y, { align: 'right' });
    totalCredit += grandTotal;
    y += 3;
    drawLine(y);
    y += 5;

    // Totals row
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(totalDebit), col2X + 15, y, { align: 'right' });
    doc.text(fmt(totalCredit), col3X + 30, y, { align: 'right' });
    y += 3;
    drawLine(y);
    y += 8;

    // Narration
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const narration = bill.Narration || '';
    if (narration) {
      const lines = doc.splitTextToSize(narration, contentWidth - 10);
      doc.text(lines, col1X + 4, y);
      y += lines.length * 4.5;
    }
    y += 8;

    // Signature line
    drawLine(y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Prepared', margin + 10, y);
    doc.text('Verified', pageWidth / 2, y, { align: 'center' });
    doc.text('Authorised Signatory', pageWidth - margin - 10, y, { align: 'right' });
    y += 12;

    // Payment Particulars section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Payment Particulars', pageWidth / 2, y, { align: 'center' });
    const ppTitleWidth = doc.getTextWidth('Payment Particulars');
    doc.setLineWidth(0.5);
    doc.line((pageWidth - ppTitleWidth) / 2, y + 1, (pageWidth + ppTitleWidth) / 2, y + 1);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Payment Vou.No. dt.____/____/______Cash/Cheque / UTR No.________________________', margin, y);
    y += 5;
    doc.text('                       dt.____ / ____ / ______Rs.___________', margin, y);
    y += 8;

    doc.text('A/c.Head :', margin, y);
    doc.text('Receiver Signature', pageWidth - margin - 10, y, { align: 'right' });

    // Save
    doc.save(`Purchase_Voucher_${bill.VoucherNo}.pdf`);
    showToast('PDF generated successfully!', 'success');
  };

  return (
    <Layout>
      <div className="relative p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <PageHeader
          title="Bill Entry (Purchase Invoice)"
          subtitle="To Add, Modify supplier purchase bill entries"
          icon={FileText}
          actionText="Add New Bill Entry"
          onActionClick={handleOpenAddDrawer}
        />

        {/* Search & Filters Card (Item Master Style) */}
        <FilterPanel
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by voucher no, GRN no, party name..."
          filters={[
            {
              label: "Party Name",
              icon: FileText,
              value: partyFilter,
              onChange: (val) => {
                setPartyFilter(val);
                setCurrentPage(1);
              },
              options: [
                { value: 'ALL', label: 'All Parties' },
                ...uniqueBillParties.map(p => ({ value: p, label: p }))
              ],
              searchable: true
            },
            {
              label: "Sort By",
              icon: ArrowUpDown,
              value: sortBy,
              onChange: (val) => setSortBy(val),
              options: [
                { value: 'newest', label: 'Date: Newest First' },
                { value: 'oldest', label: 'Date: Oldest First' },
                { value: 'voucher_desc', label: 'Voucher No: High to Low' },
                { value: 'voucher_asc', label: 'Voucher No: Low to High' },
                { value: 'total_desc', label: 'Grand Total: High to Low' }
              ]
            },
            {
              label: "Page Size",
              value: itemsPerPage,
              onChange: (val) => {
                setItemsPerPage(Number(val));
                setCurrentPage(1);
              },
              options: [
                { value: 5, label: '5 per page' },
                { value: 10, label: '10 per page' },
                { value: 25, label: '25 per page' },
                { value: 50, label: '50 per page' }
              ]
            }
          ]}
        />

        {/* Bill Entries List Card (Item Master Row Cards Layout & Colors) */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-700">All Bill Entries</h2>
            <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
              Showing {totalItems > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {paginatedBills.map((bill) => (
              <div
                key={bill.VoucherNo}
                className="p-6 hover:bg-slate-50 transition-colors duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-800 text-lg">
                          {bill.PartyName}
                        </h3>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          VCH-{String(bill.VoucherNo).padStart(3, '0')}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
                        <div>
                          <span className="text-slate-500">Acc Date:</span>{' '}
                          <span className="text-slate-700 font-medium">
                            {new Date(bill.AccDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        {bill.PartyBillNo && (
                          <div>
                            <span className="text-slate-500">Party Bill No:</span>{' '}
                            <span className="text-slate-700 font-medium">{bill.PartyBillNo}</span>
                          </div>
                        )}
                        {bill.GRNNo && (
                          <div>
                            <span className="text-slate-500">GRN No:</span>{' '}
                            <span className="text-slate-700 font-medium">GRN-{String(bill.GRNNo).padStart(3, '0')}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500">Grand Total:</span>{' '}
                          <span className="text-emerald-600 font-bold">₹{(bill.GrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePrint(bill.VoucherNo)}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/30 flex items-center gap-2 font-medium text-sm cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                    <button
                      onClick={() => handleOpenEditDrawer(bill)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-500/30 flex items-center gap-2 font-medium text-sm cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(bill.VoucherNo)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md shadow-red-500/30 flex items-center gap-2 font-medium text-sm cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {paginatedBills.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No Bill Entries found</h3>
                <p className="text-slate-500">Try adjusting your search query or add a new entry</p>
              </div>
            )}
          </div>

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rightward Slide-Over Edit Drawer (Item Master Exact Edit Drawer Modal) */}
        {editDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
              className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isDrawerVisible ? 'opacity-100' : 'opacity-0'
                }`}
              onClick={handleCloseEditDrawer}
            />

            {/* Right Drawer Modal */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <div
                className={`w-screen max-w-2xl bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isDrawerVisible ? 'translate-x-0' : 'translate-x-full'
                  }`}
              >
                {/* Drawer Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">
                        {isNewEntry ? 'Add New Bill Entry' : 'Edit Bill Entry'}
                      </h2>
                      <p className="text-xs text-blue-100">
                        Voucher No: VCH-{String(formData.VoucherNo).padStart(3, '0')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseEditDrawer}
                    className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Drawer Scrollable Form Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  <form id="bill-entry-form" onSubmit={handleSave} className="space-y-6">
                    <div>
                      {!isNewEntry ? (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Party Name</label>
                          <input
                            type="text"
                            value={formData.PartyName}
                            disabled
                            className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-semibold cursor-not-allowed"
                          />
                        </div>
                      ) : (
                        <SearchSelect
                          label="Party Name *"
                          required
                          options={parties.map(p => ({ value: p.name, label: p.name }))}
                          value={formData.PartyName}
                          onChange={(val) => setFormData(prev => ({ ...prev, PartyName: val, GateInwardNo: '', GRNNo: '' }))}
                          placeholder="Search supplier or party..."
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Gate Inward No</label>
                        {!isNewEntry ? (
                          <input
                            type="text"
                            value={formData.GateInwardNo ? `GI-${String(formData.GateInwardNo).padStart(3, '0')}` : '—'}
                            disabled
                            className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-semibold cursor-not-allowed"
                          />
                        ) : (
                          <SearchSelect
                            selectOnly
                            options={gateInwardsList.map(gi => ({
                              value: gi.InwardNo,
                              label: `GI-${String(gi.InwardNo).padStart(3, '0')}`,
                              sub: gi.InwardDate ? `Date: ${gi.InwardDate}` : ''
                            }))}
                            value={formData.GateInwardNo}
                            onChange={(val) => setFormData(prev => ({ ...prev, GateInwardNo: val, GRNNo: '' }))}
                            placeholder={formData.PartyName ? (gateInwardsList.length > 0 ? "Select Gate Inward No..." : "No available Gate Inward") : "Select Party Name first..."}
                            disabled={!formData.PartyName}
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">GRN No *</label>
                        {!isNewEntry ? (
                          <input
                            type="text"
                            value={formData.GRNNo ? `GRN-${String(formData.GRNNo).padStart(3, '0')}` : '—'}
                            disabled
                            className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-semibold cursor-not-allowed"
                          />
                        ) : (
                          <SearchSelect
                            selectOnly
                            options={grnsList.map(r => ({
                              value: r.GRNNo,
                              label: `GRN-${r.GRNNo} (GI-${r.GateInwardNo})`,
                              sub: `Amount: ₹${r.GrandTotal || r.BillAmount || 0}`
                            }))}
                            value={formData.GRNNo}
                            onChange={(val) => setFormData(prev => ({ ...prev, GRNNo: val }))}
                            placeholder={formData.PartyName ? (grnsList.length > 0 ? "Select GRN..." : "No available GRN") : "Select Party Name first..."}
                            disabled={!formData.PartyName}
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Party Bill No</label>
                        <input
                          type="text"
                          value={formData.PartyBillNo}
                          onChange={(e) => setFormData({ ...formData, PartyBillNo: e.target.value })}
                          placeholder="Enter Party Bill No (optional)"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Accounting Date</label>
                        <input
                          type="date"
                          value={formData.AccDate}
                          onChange={(e) => setFormData({ ...formData, AccDate: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Bill Date</label>
                        <input
                          type="date"
                          value={formData.BillDate}
                          onChange={(e) => setFormData({ ...formData, BillDate: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <CustomSelect
                        label="Purchase Type"
                        value={formData.PurchaseType}
                        onChange={(val) => setFormData(prev => ({ ...prev, PurchaseType: val }))}
                        options={[
                          { value: '', label: 'Select Purchase Type' },
                          ...purchaseTypes.map(pt => ({ value: pt.PurchaseType || pt.typename || pt.type, label: pt.PurchaseType || pt.typename || pt.type }))
                        ]}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Narration</label>
                      <textarea
                        value={formData.Narration}
                        onChange={(e) => setFormData({ ...formData, Narration: e.target.value })}
                        placeholder=""
                        rows={3}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                      />
                    </div>

                    {/* Items List Table */}
                    {items.length > 0 && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                        <div className="p-3 bg-slate-50 border-b border-slate-200">
                          <h4 className="text-sm font-semibold text-slate-700">Billed Items ({items.length})</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 bg-white text-slate-500 font-semibold uppercase text-[11px]">
                                <th className="py-2.5 px-3">Item Name</th>
                                <th className="py-2.5 px-3 text-right">Qty</th>
                                <th className="py-2.5 px-3 text-right">Unit Rate (₹)</th>
                                <th className="py-2.5 px-3 text-right font-bold">Total Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {items.map((item, idx) => {
                                const qty = parseFloat(item.ReceivedQty ?? item.Qty) || 0;
                                const rate = parseFloat(item.UnitRate) || 0;
                                const rowTotal = qty * rate;
                                return (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.ItemName}</td>
                                    <td className="py-2.5 px-3 text-right font-medium">{qty}</td>
                                    <td className="py-2.5 px-3 text-right font-medium">₹{rate.toFixed(2)}</td>
                                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                      ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Financial Summary */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Items Subtotal:</span>
                        <span className="font-bold text-slate-800">₹{(formData.Total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Discount (₹)</label>
                          <input
                            type="number"
                            step="1" value={formData.Discount}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData({ ...formData, Discount: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">GST (₹)</label>
                          <input
                            type="number"
                            step="1" value={formData.GST}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData({ ...formData, GST: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-200">
                        <span>Round Off:</span>
                        <span className="font-semibold">{formatRoundOff(formData.RoundOff)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                        <span>Grand Total:</span>
                        <span className="text-emerald-600 text-lg">₹{(formData.GrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Drawer Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseEditDrawer}
                    className="px-5 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-medium text-sm transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="bill-entry-form"
                    disabled={loading}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium text-sm shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isNewEntry ? 'Save Bill Entry' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Scoped Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-30 rounded-2xl min-h-[400px]">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl flex items-center gap-3">
              <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-slate-700 font-semibold text-xs tracking-wide">Loading data...</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
