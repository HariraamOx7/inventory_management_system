const PartyMaster = require('../models/PartyMaster');
const Supplier = require('../models/Supplier');

exports.getParties = async (req, res) => {
    try {
        const parties = await PartyMaster.findAll({
            order: [['Code', 'ASC']]
        });
        res.json({
            success: true,
            data: parties
        });
    } catch (error) {
        console.error('Error fetching parties:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching parties',
            error: error.message 
        });
    }
};

// Get supplier details by account name for auto-fill
exports.getSupplierByName = async (req, res) => {
    try {
        const { accountName } = req.query;
        
        if (!accountName) {
            return res.status(400).json({
                success: false,
                message: 'Account name is required'
            });
        }

        const supplier = await Supplier.findOne({
            where: { AccountName: accountName }
        });

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found',
                data: null
            });
        }

        res.json({
            success: true,
            data: {
                Place: supplier.Place || '',
                Address: supplier.Address || '',
                DeliveryAddress: supplier.DeliveryAddress || '',
                TINNo: supplier.TINNo || '',
                CSTNo: supplier.CSTNo || '',
                PhNo: supplier.PhNo || '',
                Email: supplier.Email || '',
                Fax: supplier.Fax || '',
                WebSite: supplier.WebSite || '',
                AccountNo: supplier.AccountNo || '',
                ContactPerson: supplier.ContactPerson || '',
                CellNo: supplier.CellNo || '',
                ECCode: supplier.ECCode || '',
                Range: supplier.Range || '',
                Division: supplier.Division || '',
                GSTNo: supplier.GSTNo || ''
            }
        });
    } catch (error) {
        console.error('Error fetching supplier:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching supplier details',
            error: error.message 
        });
    }
};

// Get all suppliers for dropdown
exports.getSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.findAll({
            attributes: ['AccCode', 'AccountName'],
            order: [['AccountName', 'ASC']]
        });
        res.json({
            success: true,
            data: suppliers
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

exports.addParty = async (req, res) => {
    try {
        const {
            Code, AccountName, Place, Address, DeliveryAddress, TINNo, CSTNo,
            PhNo, Email, Fax, WebSite, AccountNo, ContactPerson, CellNo,
            ECCode, Range, Division, GSTNo
        } = req.body;
        
        if (!Code || !AccountName) {
            return res.status(400).json({
                success: false,
                message: 'Code and Account Name are required'
            });
        }
        
        const newParty = await PartyMaster.create({ 
            Code: Code.trim(),
            AccountName: AccountName.trim(),
            Place: Place ? Place.trim() : null,
            Address: Address ? Address.trim() : null,
            DeliveryAddress: DeliveryAddress ? DeliveryAddress.trim() : null,
            TINNo: TINNo ? TINNo.trim() : null,
            CSTNo: CSTNo ? CSTNo.trim() : null,
            PhNo: PhNo ? PhNo.trim() : null,
            Email: Email ? Email.trim() : null,
            Fax: Fax ? Fax.trim() : null,
            WebSite: WebSite ? WebSite.trim() : null,
            AccountNo: AccountNo ? AccountNo.trim() : null,
            ContactPerson: ContactPerson ? ContactPerson.trim() : null,
            CellNo: CellNo ? CellNo.trim() : null,
            ECCode: ECCode ? ECCode.trim() : null,
            Range: Range ? Range.trim() : null,
            Division: Division ? Division.trim() : null,
            GSTNo: GSTNo ? GSTNo.trim() : null
        });
        
        res.status(201).json({
            success: true,
            data: newParty
        });
    } catch (error) {
        console.error('Error adding party:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'Party with this code already exists',
                error: error.message
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error adding party',
            error: error.message 
        });
    }
};

exports.updateParty = async (req, res) => {
    try {
        const { code } = req.params;
        const {
            AccountName, Place, Address, DeliveryAddress, TINNo, CSTNo,
            PhNo, Email, Fax, WebSite, AccountNo, ContactPerson, CellNo,
            ECCode, Range, Division, GSTNo
        } = req.body;

        const party = await PartyMaster.findByPk(code);
        if (!party) {
            return res.status(404).json({
                success: false,
                message: 'Party not found'
            });
        }

        await party.update({ 
            AccountName: AccountName ? AccountName.trim() : party.AccountName,
            Place: Place ? Place.trim() : null,
            Address: Address ? Address.trim() : null,
            DeliveryAddress: DeliveryAddress ? DeliveryAddress.trim() : null,
            TINNo: TINNo ? TINNo.trim() : null,
            CSTNo: CSTNo ? CSTNo.trim() : null,
            PhNo: PhNo ? PhNo.trim() : null,
            Email: Email ? Email.trim() : null,
            Fax: Fax ? Fax.trim() : null,
            WebSite: WebSite ? WebSite.trim() : null,
            AccountNo: AccountNo ? AccountNo.trim() : null,
            ContactPerson: ContactPerson ? ContactPerson.trim() : null,
            CellNo: CellNo ? CellNo.trim() : null,
            ECCode: ECCode ? ECCode.trim() : null,
            Range: Range ? Range.trim() : null,
            Division: Division ? Division.trim() : null,
            GSTNo: GSTNo ? GSTNo.trim() : null
        });

        res.json({
            success: true,
            data: party
        });
    } catch (error) {
        console.error('Error updating party:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating party',
            error: error.message
        });
    }
};

exports.deleteParty = async (req, res) => {
    try {
        const { code } = req.params;
        
        const party = await PartyMaster.findByPk(code);
        if (!party) {
            return res.status(404).json({
                success: false,
                message: 'Party not found'
            });
        }

        await party.destroy();

        res.json({
            success: true,
            message: 'Party deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting party:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting party',
            error: error.message
        });
    }
};