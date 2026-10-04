// backend/controllers/billVerifyController.js
const { Op } = require('sequelize');
const BillVerify = require('../models/BillVerify');
const BillEntry = require('../models/BillEntry');
const Supplier = require('../models/Supplier');

// Get bill verify records with filters
exports.getBillVerifyRecords = async (req, res) => {
  try {
    const { fromDate, toDate, partyName, paymentStatus } = req.query;
    
    const where = {};
    
    if (fromDate && toDate) {
      where.VerifyDate = {
        [Op.between]: [fromDate, toDate]
      };
    }
    
    if (partyName) {
      where.PartyName = partyName;
    }
    
    if (paymentStatus && paymentStatus !== 'All') {
      where.PaymentStatus = paymentStatus;
    }

    const records = await BillVerify.findAll({
      where,
      order: [['VerifyNo', 'DESC']]
    });

    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error('Error fetching bill verify records:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bill verify records',
      error: error.message
    });
  }
};

// Get all party names for dropdown
exports.getPartyNames = async (req, res) => {
  try {
    const records = await BillEntry.findAll({
      attributes: ['PartyCode'],
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName']
        }
      ],
      group: ['BillEntry.PartyCode', 'supplier.PartyCode', 'supplier.AccountName'],
      order: [['PartyCode', 'ASC']]
    });

    const partyNames = [...new Set(records.map(r => {
      const p = r.toJSON();
      return p.supplier ? p.supplier.AccountName : p.PartyCode;
    }).filter(Boolean))];

    res.json({
      success: true,
      data: partyNames
    });
  } catch (error) {
    console.error('Error fetching party names:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching party names',
      error: error.message
    });
  }
};

// Get bills by party name
exports.getBillsByParty = async (req, res) => {
  try {
    const { partyName, partyCode } = req.query;

    if (!partyName && !partyCode) {
      return res.status(400).json({
        success: false,
        message: 'Party name or party code is required'
      });
    }

    let resolvedPartyCode = partyCode;
    if (!resolvedPartyCode && partyName) {
      const sup = await Supplier.findOne({
        where: {
          [Op.or]: [
            { AccountName: partyName.trim() },
            { PartyCode: partyName.trim() }
          ]
        }
      });
      resolvedPartyCode = sup ? sup.PartyCode : partyName.trim();
    }

    const bills = await BillEntry.findAll({
      attributes: ['VoucherNo', 'BillDate', 'PartyCode', 'BillAmount', 'GST', 'IGST'],
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName']
        }
      ],
      where: { PartyCode: resolvedPartyCode },
      order: [['VoucherNo', 'DESC']]
    });

    const formatted = bills.map(b => {
      const p = b.toJSON();
      p.PartyName = p.supplier?.AccountName || p.PartyCode;
      return p;
    });

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching bills by party:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bills',
      error: error.message
    });
  }
};

// Create bill verify record
exports.createBillVerify = async (req, res) => {
  try {
    const { VoucherNo, BillNo, BillDate, PartyName, BillAmount, GSTAmount, IGSTAmount, PaymentStatus, Remarks } = req.body;

    if (!VoucherNo || !BillNo || !PartyName) {
      return res.status(400).json({
        success: false,
        message: 'Voucher number, bill number, and party name are required'
      });
    }

    const billVerify = await BillVerify.create({
      VoucherNo,
      BillNo,
      BillDate,
      PartyName,
      BillAmount,
      GSTAmount,
      IGSTAmount,
      PaymentStatus: PaymentStatus || 'Unpaid',
      Remarks,
      VerifyDate: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Bill verify record created successfully',
      data: billVerify
    });
  } catch (error) {
    console.error('Error creating bill verify record:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating bill verify record',
      error: error.message
    });
  }
};

// Update bill verify record
exports.updateBillVerify = async (req, res) => {
  try {
    const { verifyNo } = req.params;
    const { PaymentStatus, Remarks } = req.body;

    const billVerify = await BillVerify.findByPk(verifyNo);
    
    if (!billVerify) {
      return res.status(404).json({
        success: false,
        message: 'Bill verify record not found'
      });
    }

    await billVerify.update({
      PaymentStatus,
      Remarks
    });

    res.json({
      success: true,
      message: 'Bill verify record updated successfully',
      data: billVerify
    });
  } catch (error) {
    console.error('Error updating bill verify record:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating bill verify record',
      error: error.message
    });
  }
};

// Delete bill verify record
exports.deleteBillVerify = async (req, res) => {
  try {
    const { verifyNo } = req.params;

    const billVerify = await BillVerify.findByPk(verifyNo);
    
    if (!billVerify) {
      return res.status(404).json({
        success: false,
        message: 'Bill verify record not found'
      });
    }

    await billVerify.destroy();

    res.json({
      success: true,
      message: 'Bill verify record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting bill verify record:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting bill verify record',
      error: error.message
    });
  }
};