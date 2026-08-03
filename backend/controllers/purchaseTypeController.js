const PurchaseType = require('../models/PurchaseType');

// Default formulas for reset functionality
const DEFAULT_FORMULAS = {
  AssessValue: '[TotalAmount]-[DiscountAmount]',
  RoundOff: '[RoundOff]',
  LorryFreight: '[PFAmount]+[LorryFreightN]',
  SGST: '[SGST]',
  CGST: '[CGST]',
  IGST: '[IGST]',
  TCS: '[TCS]'
};

// 1. FETCH ALL PURCHASE TYPES
exports.getPurchaseTypes = async (req, res) => {
  try {
    const purchaseTypes = await PurchaseType.findAll({
      order: [['Code', 'ASC']]
    });

    res.json({
      success: true,
      data: purchaseTypes
    });
  } catch (error) {
    console.error('Error fetching purchase types:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase types',
      error: error.message
    });
  }
};

// 2. GET SINGLE PURCHASE TYPE BY CODE
exports.getPurchaseTypeByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const purchaseType = await PurchaseType.findByPk(code);

    if (!purchaseType) {
      return res.status(404).json({
        success: false,
        message: 'Purchase Type not found'
      });
    }

    res.json({
      success: true,
      data: purchaseType
    });
  } catch (error) {
    console.error('Error fetching purchase type:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase type',
      error: error.message
    });
  }
};

// 3. GET NEXT CODE (auto-increment)
exports.getNextCode = async (req, res) => {
  try {
    const maxCode = await PurchaseType.max('Code');
    const nextCode = (maxCode || 0) + 1;

    res.json({
      success: true,
      data: { nextCode }
    });
  } catch (error) {
    console.error('Error getting next code:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting next code',
      error: error.message
    });
  }
};

// 4. GET DEFAULT FORMULAS (for reset button)
exports.getDefaultFormulas = async (req, res) => {
  try {
    res.json({
      success: true,
      data: DEFAULT_FORMULAS
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching default formulas',
      error: error.message
    });
  }
};

// 5. ADD NEW PURCHASE TYPE
exports.addPurchaseType = async (req, res) => {
  try {
    const {
      Code, PurchaseType: PurchaseTypeValue, Description, AssessValue,
      VAT1, VAT2, RoundOff, Duty1, Duty2,
      EduChess1, EduChess2, HSChess1, HSChess2,
      Commodity, TDS, LorryFreight,
      SGST, SGSTLedger, CGST, CGSTLedger,
      IGST, IGSTLedger, TCS, TCSLedger
    } = req.body;

    if (!PurchaseTypeValue) {
      return res.status(400).json({
        success: false,
        message: 'Purchase Type name is required'
      });
    }

    // Auto-generate code if not provided
    let code = Code;
    if (!code) {
      const maxCode = await PurchaseType.max('Code');
      code = (maxCode || 0) + 1;
    }

    // Check for duplicate code
    const existingCode = await PurchaseType.findByPk(code);
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: `Code ${code} already exists`
      });
    }

    // Check for duplicate purchase type name
    const existingName = await PurchaseType.findOne({
      where: { PurchaseType: PurchaseTypeValue.trim() }
    });
    if (existingName) {
      return res.status(400).json({
        success: false,
        message: `Purchase Type "${PurchaseTypeValue}" already exists`
      });
    }

    const newPurchaseType = await PurchaseType.create({
      Code: code,
      PurchaseType: PurchaseTypeValue.trim(),
      Description: Description || null,
      AssessValue: AssessValue || null,
      VAT1: VAT1 || null,
      VAT2: VAT2 || null,
      RoundOff: RoundOff || null,
      Duty1: Duty1 || null,
      Duty2: Duty2 || null,
      EduChess1: EduChess1 || null,
      EduChess2: EduChess2 || null,
      HSChess1: HSChess1 || null,
      HSChess2: HSChess2 || null,
      Commodity: Commodity || null,
      TDS: TDS || null,
      LorryFreight: LorryFreight || null,
      SGST: SGST || null,
      SGSTLedger: SGSTLedger || null,
      CGST: CGST || null,
      CGSTLedger: CGSTLedger || null,
      IGST: IGST || null,
      IGSTLedger: IGSTLedger || null,
      TCS: TCS || null,
      TCSLedger: TCSLedger || null
    });

    res.status(201).json({
      success: true,
      message: 'Purchase Type added successfully',
      data: newPurchaseType
    });
  } catch (error) {
    console.error('Error adding purchase type:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding purchase type',
      error: error.message
    });
  }
};

// 6. UPDATE PURCHASE TYPE
exports.updatePurchaseType = async (req, res) => {
  try {
    const { code } = req.params;
    const {
      PurchaseType: PurchaseTypeValue, Description, AssessValue,
      VAT1, VAT2, RoundOff, Duty1, Duty2,
      EduChess1, EduChess2, HSChess1, HSChess2,
      Commodity, TDS, LorryFreight,
      SGST, SGSTLedger, CGST, CGSTLedger,
      IGST, IGSTLedger, TCS, TCSLedger
    } = req.body;

    const purchaseType = await PurchaseType.findByPk(code);
    if (!purchaseType) {
      return res.status(404).json({
        success: false,
        message: 'Purchase Type not found'
      });
    }

    if (PurchaseTypeValue) {
      // Check for duplicate name (excluding current record)
      const existingName = await PurchaseType.findOne({
        where: { PurchaseType: PurchaseTypeValue.trim() }
      });
      if (existingName && existingName.Code !== parseInt(code)) {
        return res.status(400).json({
          success: false,
          message: `Purchase Type "${PurchaseTypeValue}" already exists`
        });
      }
    }

    await purchaseType.update({
      PurchaseType: PurchaseTypeValue ? PurchaseTypeValue.trim() : purchaseType.PurchaseType,
      Description: Description !== undefined ? Description : purchaseType.Description,
      AssessValue: AssessValue !== undefined ? AssessValue : purchaseType.AssessValue,
      VAT1: VAT1 !== undefined ? VAT1 : purchaseType.VAT1,
      VAT2: VAT2 !== undefined ? VAT2 : purchaseType.VAT2,
      RoundOff: RoundOff !== undefined ? RoundOff : purchaseType.RoundOff,
      Duty1: Duty1 !== undefined ? Duty1 : purchaseType.Duty1,
      Duty2: Duty2 !== undefined ? Duty2 : purchaseType.Duty2,
      EduChess1: EduChess1 !== undefined ? EduChess1 : purchaseType.EduChess1,
      EduChess2: EduChess2 !== undefined ? EduChess2 : purchaseType.EduChess2,
      HSChess1: HSChess1 !== undefined ? HSChess1 : purchaseType.HSChess1,
      HSChess2: HSChess2 !== undefined ? HSChess2 : purchaseType.HSChess2,
      Commodity: Commodity !== undefined ? Commodity : purchaseType.Commodity,
      TDS: TDS !== undefined ? TDS : purchaseType.TDS,
      LorryFreight: LorryFreight !== undefined ? LorryFreight : purchaseType.LorryFreight,
      SGST: SGST !== undefined ? SGST : purchaseType.SGST,
      SGSTLedger: SGSTLedger !== undefined ? SGSTLedger : purchaseType.SGSTLedger,
      CGST: CGST !== undefined ? CGST : purchaseType.CGST,
      CGSTLedger: CGSTLedger !== undefined ? CGSTLedger : purchaseType.CGSTLedger,
      IGST: IGST !== undefined ? IGST : purchaseType.IGST,
      IGSTLedger: IGSTLedger !== undefined ? IGSTLedger : purchaseType.IGSTLedger,
      TCS: TCS !== undefined ? TCS : purchaseType.TCS,
      TCSLedger: TCSLedger !== undefined ? TCSLedger : purchaseType.TCSLedger
    });

    res.json({
      success: true,
      message: 'Purchase Type updated successfully',
      data: purchaseType
    });
  } catch (error) {
    console.error('Error updating purchase type:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating purchase type',
      error: error.message
    });
  }
};

// 7. DELETE PURCHASE TYPE
exports.deletePurchaseType = async (req, res) => {
  try {
    const { code } = req.params;

    const purchaseType = await PurchaseType.findByPk(code);
    if (!purchaseType) {
      return res.status(404).json({
        success: false,
        message: 'Purchase Type not found'
      });
    }

    await purchaseType.destroy();

    res.json({
      success: true,
      message: 'Purchase Type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting purchase type:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting purchase type',
      error: error.message
    });
  }
};