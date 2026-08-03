const { Op } = require('sequelize');
const Supplier = require('../models/Supplier');

exports.getSuppliers = async (req, res) => {
  try {
    const { search, department, place, gstStatus, page, limit } = req.query;
    
    const andConditions = [];

    if (search && search.trim() !== '') {
      andConditions.push({
        AccountName: { [Op.like]: `%${search.trim()}%` }
      });
    }

    if (department && department !== 'ALL') {
      andConditions.push({ Department: department });
    }

    if (place && place !== 'ALL') {
      andConditions.push({ Place: place });
    }

    if (gstStatus === 'registered') {
      andConditions.push({
        GSTNo: {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.ne]: '' }
          ]
        }
      });
    } else if (gstStatus === 'unregistered') {
      andConditions.push({
        [Op.or]: [
          { GSTNo: null },
          { GSTNo: '' }
        ]
      });
    }

    const queryOptions = {
      order: [['AccCode', 'ASC']]
    };

    if (andConditions.length > 0) {
      queryOptions.where = { [Op.and]: andConditions };
    }

    if (page || limit) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.max(1, parseInt(limit) || 10);
      queryOptions.limit = limitNum;
      queryOptions.offset = (pageNum - 1) * limitNum;
    }

    const { count, rows } = await Supplier.findAndCountAll(queryOptions);
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = parseInt(limit) || count || 10;

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        totalPages: Math.ceil(count / limitNum) || 1,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching suppliers',
      error: error.message 
    });
  }
};

// Add this new function
exports.getLastCode = async (req, res) => {
  try {
    const lastSupplier = await Supplier.findOne({
      order: [['AccCode', 'DESC']],
      attributes: ['AccCode']
    });
    
    const lastCode = lastSupplier ? lastSupplier.AccCode : 0;
    res.json({
      success: true,
      data: { lastCode: lastCode }
    });
  } catch (error) {
    console.error('Error fetching last code:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching last code',
      error: error.message
    });
  }
};

// Update addSupplier to auto-generate AccCode
exports.addSupplier = async (req, res) => {
  try {
    const {
      Description, AccountName, Place, Address, DeliveryAddress,
      OpeningCredit, OpeningDebit, TINNo, CSTNo, PhNo, Fax, CellNo, Email,
      WebSite, AccountNo, ContactPerson, Pincode, PanNumber, Department, GSTNo
    } = req.body;
    
    if (!AccountName) {
      return res.status(400).json({
        success: false,
        message: 'Account Name is required'
      });
    }
    
    const newSupplier = await Supplier.create({ 
      Description: Description ? Description.trim() : null,
      AccountName: AccountName ? AccountName.trim() : null,
      Place: Place ? Place.trim() : null,
      Address: Address ? Address.trim() : null,
      DeliveryAddress: DeliveryAddress ? DeliveryAddress.trim() : null,
      OpeningCredit: OpeningCredit || 0,
      OpeningDebit: OpeningDebit || 0,
      TINNo: TINNo ? TINNo.trim() : null,
      CSTNo: CSTNo ? CSTNo.trim() : null,
      PhNo: PhNo ? PhNo.trim() : null,
      Fax: Fax ? Fax.trim() : null,
      CellNo: CellNo ? CellNo.trim() : null,
      Email: Email ? Email.trim() : null,
      WebSite: WebSite ? WebSite.trim() : null,
      AccountNo: AccountNo ? AccountNo.trim() : null,
      ContactPerson: ContactPerson ? ContactPerson.trim() : null,
      Pincode: Pincode ? Pincode.trim() : null,
      PanNumber: PanNumber ? PanNumber.trim() : null,
      Department: Department ? Department.trim() : null,
      GSTNo: GSTNo ? GSTNo.trim() : null
    });
    
    res.status(201).json({
      success: true,
      data: newSupplier
    });
  } catch (error) {
    console.error('Error adding supplier:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding supplier',
      error: error.message 
    });
  }
};

// Update updateSupplier
exports.updateSupplier = async (req, res) => {
  try {
    const { accCode } = req.params;
    const {
      Description, AccountName, Place, Address, DeliveryAddress,
      OpeningCredit, OpeningDebit, TINNo, CSTNo, PhNo, Fax, CellNo, Email,
      WebSite, AccountNo, ContactPerson, Pincode, PanNumber, Department, GSTNo
    } = req.body;

    const supplier = await Supplier.findByPk(parseInt(accCode));
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    await supplier.update({
      Description: Description ? Description.trim() : null,
      AccountName: AccountName ? AccountName.trim() : null,
      Place: Place ? Place.trim() : null,
      Address: Address ? Address.trim() : null,
      DeliveryAddress: DeliveryAddress ? DeliveryAddress.trim() : null,
      OpeningCredit: OpeningCredit || 0,
      OpeningDebit: OpeningDebit || 0,
      TINNo: TINNo ? TINNo.trim() : null,
      CSTNo: CSTNo ? CSTNo.trim() : null,
      PhNo: PhNo ? PhNo.trim() : null,
      Fax: Fax ? Fax.trim() : null,
      CellNo: CellNo ? CellNo.trim() : null,
      Email: Email ? Email.trim() : null,
      WebSite: WebSite ? WebSite.trim() : null,
      AccountNo: AccountNo ? AccountNo.trim() : null,
      ContactPerson: ContactPerson ? ContactPerson.trim() : null,
      Pincode: Pincode ? Pincode.trim() : null,
      PanNumber: PanNumber ? PanNumber.trim() : null,
      Department: Department ? Department.trim() : null,
      GSTNo: GSTNo ? GSTNo.trim() : null
    });

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating supplier',
      error: error.message
    });
  }
};

// Update deleteSupplier
exports.deleteSupplier = async (req, res) => {
  try {
    const { accCode } = req.params;

    const supplier = await Supplier.findByPk(parseInt(accCode));
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    await supplier.destroy();
    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting supplier',
      error: error.message
    });
  }
};