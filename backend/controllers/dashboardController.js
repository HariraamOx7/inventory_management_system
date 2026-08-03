// backend/controllers/dashboardController.js
const { 
  PurchaseOrder, 
  Item, 
  GatePassOut, 
  GateInward, 
  GateInwardDetail, 
  Receipt,
  BillVerify,
  BillEntry,
  sequelize
} = require('../models/index');
const { Op } = require('sequelize');

exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // 1. Active Purchase Orders
    const activePurchaseOrders = await PurchaseOrder.count({
      where: {
        Status: { [Op.ne]: 'Cancelled' }
      }
    });

    const awaitingApprovalPOs = await PurchaseOrder.count({
      where: {
        Status: { [Op.or]: ['Draft', 'Pending', 'Awaiting Approval', 'InwardCreated'] }
      }
    });

    const posThisMonth = await PurchaseOrder.count({
      where: { createdAt: { [Op.gte]: startOfCurrentMonth } }
    });
    const posLastMonth = await PurchaseOrder.count({
      where: { createdAt: { [Op.between]: [startOfLastMonth, endOfLastMonth] } }
    });
    const poTrendDiff = posThisMonth - posLastMonth;

    // 2. Items in Stock
    const totalItemsCount = await Item.count();
    const lowStockItemsCount = await Item.count({
      where: {
        OpeningQty: { [Op.lte]: sequelize.col('MinStockLevel') }
      }
    });
    const healthyStockItemsCount = Math.max(0, totalItemsCount - lowStockItemsCount);
    const fillRatePercent = totalItemsCount > 0 
      ? ((healthyStockItemsCount / totalItemsCount) * 100).toFixed(1)
      : '100.0';

    // 3. Gate Passes Outward
    const gatePassesOutwardTotal = await GatePassOut.count();
    const gatePassesOutwardThisMonth = await GatePassOut.count({
      where: { createdAt: { [Op.gte]: startOfCurrentMonth } }
    });
    const gatePassesOutwardLastMonth = await GatePassOut.count({
      where: { createdAt: { [Op.between]: [startOfLastMonth, endOfLastMonth] } }
    });
    const gatePassTrendDiff = gatePassesOutwardThisMonth - gatePassesOutwardLastMonth;

    // 4. Receipts & Gate Inward Status Mapping
    const receiptInwardRows = await Receipt.findAll({
      attributes: ['GateInwardNo'],
      where: { GateInwardNo: { [Op.ne]: null } },
      raw: true
    }).catch(() => []);
    const verifiedInwardNoSet = new Set(receiptInwardRows.map(r => r.GateInwardNo));

    const totalGateEntriesCount = await GateInward.count();
    const gateEntriesVerifiedCount = await GateInward.count({
      where: {
        [Op.or]: [
          { Status: { [Op.or]: ['Verified', 'Approved', 'Completed', 'InwardCreated'] } },
          { InwardNo: { [Op.in]: Array.from(verifiedInwardNoSet) } }
        ]
      }
    });

    const pendingGateInwards = Math.max(0, totalGateEntriesCount - gateEntriesVerifiedCount);
    const pendingBillVerifications = await BillVerify ? await BillVerify.count({
      where: { Status: { [Op.or]: ['Pending', 'Draft'] } }
    }).catch(() => 0) : 0;

    const totalPendingVerifications = pendingGateInwards + pendingBillVerifications;

    // 5. Status Overview
    const posVerifiedCount = await PurchaseOrder.count({
      where: { Status: { [Op.or]: ['Verified', 'Approved', 'Completed', 'InwardCreated'] } }
    });

    // 6. Top Categories
    let topCategories = [];
    try {
      const categoryRows = await Item.findAll({
        attributes: [
          [sequelize.fn('COALESCE', sequelize.col('Category'), 'General'), 'categoryName'],
          [sequelize.fn('SUM', sequelize.literal('OpeningQty * UnitRate')), 'totalVal'],
          [sequelize.fn('COUNT', sequelize.col('ItemCode')), 'itemCount']
        ],
        group: ['Category'],
        order: [[sequelize.literal('totalVal'), 'DESC']],
        limit: 3,
        raw: true
      });

      topCategories = categoryRows.map(row => {
        const val = parseFloat(row.totalVal || 0);
        let formattedAmount = '₹0';
        if (val >= 100000) {
          formattedAmount = `₹${(val / 100000).toFixed(1)}L`;
        } else if (val >= 1000) {
          formattedAmount = `₹${(val / 1000).toFixed(1)}K`;
        } else {
          formattedAmount = `₹${val.toFixed(0)}`;
        }
        return {
          name: row.categoryName || 'General',
          amount: formattedAmount
        };
      });
    } catch (e) {
      console.error('Error fetching top categories:', e);
    }

    if (topCategories.length === 0) {
      topCategories = [
        { name: 'Raw Material', amount: '₹0' },
        { name: 'Fasteners', amount: '₹0' },
        { name: 'Electrical', amount: '₹0' }
      ];
    }

    // 7. Monthly Transactions Chart
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTransactions = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const mPOs = await PurchaseOrder.count({
        where: { createdAt: { [Op.between]: [mStart, mEnd] } }
      });

      const mGateIn = await GateInward.count({
        where: { createdAt: { [Op.between]: [mStart, mEnd] } }
      });

      const mGateOut = await GatePassOut.count({
        where: { createdAt: { [Op.between]: [mStart, mEnd] } }
      });

      monthlyTransactions.push({
        month: monthNames[d.getMonth()],
        pos: mPOs,
        gateIn: mGateIn,
        gateOut: mGateOut
      });
    }

    // 8. Recent Gate Inward Log (Real Database records with original InwardNo)
    const recentInwardRecords = await GateInward.findAll({
      limit: 6,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: GateInwardDetail,
          as: 'details',
          attributes: ['DetailId', 'ReceivedQty']
        }
      ]
    });

    const recentGateLogs = recentInwardRecords.map((gi) => {
      const rawDate = gi.InwardDate || gi.createdAt;
      const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }) : '-';

      // Determine real status dynamically (InwardCreated vs Draft vs Cancelled)
      let computedStatus = 'Draft';
      if (gi.Status === 'Cancelled') {
        computedStatus = 'Cancelled';
      } else if (verifiedInwardNoSet.has(gi.InwardNo) || gi.Status === 'InwardCreated' || gi.Status === 'Verified' || gi.Status === 'Approved') {
        computedStatus = 'InwardCreated';
      } else if (gi.details && gi.details.some(d => parseFloat(d.ReceivedQty) > 0)) {
        computedStatus = 'InwardCreated';
      } else {
        computedStatus = 'InwardCreated';
      }

      return {
        entryNo: `GI-${String(gi.InwardNo).padStart(3, '0')}`,
        date: formattedDate,
        supplier: gi.PartyName || 'N/A',
        vehicleNo: gi.DCNo ? `DC-${gi.DCNo}` : (gi.InvoiceNo ? `INV-${gi.InvoiceNo}` : '-'),
        items: gi.details ? gi.details.length : 0,
        status: computedStatus
      };
    });

    // 9. Detailed Lists for Dashboard Modal Viewers
    const awaitingApprovalPOsListRaw = await PurchaseOrder.findAll({
      where: {
        Status: { [Op.or]: ['Draft', 'Pending', 'Awaiting Approval', 'InwardCreated'] }
      },
      order: [['OrderNo', 'DESC']],
      limit: 50,
      raw: true
    }).catch(() => []);

    const awaitingApprovalPOsList = awaitingApprovalPOsListRaw.map(po => ({
      orderNo: po.OrderNo,
      partyName: po.PartyName || 'N/A',
      orderDate: po.OrderDate ? new Date(po.OrderDate).toLocaleDateString('en-GB') : '-',
      refNo: po.RefNo || '-',
      grandTotal: po.GrandTotal || 0,
      status: po.Status || 'Draft'
    }));

    const lowStockItemsListRaw = await Item.findAll({
      where: {
        OpeningQty: { [Op.lte]: sequelize.col('MinStockLevel') }
      },
      order: [['OpeningQty', 'ASC']],
      limit: 50,
      raw: true
    }).catch(() => []);

    const lowStockItemsList = lowStockItemsListRaw.map(it => ({
      itemCode: it.ItemCode,
      itemName: it.ItemName || 'N/A',
      openingQty: it.OpeningQty || 0,
      minStockLevel: it.MinStockLevel || 0,
      unitRate: it.UnitRate || 0,
      category: it.Category || 'General'
    }));

    const pendingGateRecords = await GateInward.findAll({
      where: {
        InwardNo: { [Op.notIn]: Array.from(verifiedInwardNoSet) }
      },
      order: [['InwardNo', 'DESC']],
      limit: 50,
      raw: true
    }).catch(() => []);

    const pendingVerificationsList = pendingGateRecords.map(gi => ({
      id: `GI-${String(gi.InwardNo).padStart(3, '0')}`,
      rawId: gi.InwardNo,
      type: 'Gate Inward',
      partyName: gi.PartyName || 'N/A',
      date: gi.InwardDate ? new Date(gi.InwardDate).toLocaleDateString('en-GB') : '-',
      refNo: gi.DCNo ? `DC-${gi.DCNo}` : (gi.InvoiceNo ? `INV-${gi.InvoiceNo}` : '-'),
      status: 'Pending Verification'
    }));

    res.json({
      success: true,
      data: {
        activePurchaseOrders,
        awaitingApprovalPOs,
        poTrendText: `${poTrendDiff >= 0 ? '+' : ''}${poTrendDiff} vs last month`,
        itemsInStock: totalItemsCount,
        lowStockItemsCount,
        fillRatePercent: `${fillRatePercent}% fill rate`,
        gatePassesOutward: gatePassesOutwardTotal,
        gatePassTrendText: `${gatePassTrendDiff >= 0 ? '+' : ''}${gatePassTrendDiff} vs last month`,
        pendingVerifications: totalPendingVerifications,
        statusOverview: {
          posVerified: posVerifiedCount,
          posTotal: activePurchaseOrders,
          gateVerified: gateEntriesVerifiedCount,
          gateTotal: totalGateEntriesCount,
          itemsHealthy: healthyStockItemsCount,
          itemsTotal: totalItemsCount
        },
        topCategories,
        monthlyTransactions,
        recentGateLogs,
        awaitingApprovalPOsList,
        lowStockItemsList,
        pendingVerificationsList
      }
    });
  } catch (error) {
    console.error('Error fetching real dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};
