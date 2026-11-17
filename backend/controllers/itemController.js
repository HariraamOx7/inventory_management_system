const preventReferencedDeletion = require('../services/preventReferencedDeletion');
const errorStatus = require('../services/errorStatus');
const Item = require('../models/Item');
const Department = require('../models/Department');
const SubHead = require('../models/SubHead');
const { Op } = require('sequelize');
const sequelize = require('../config/db');

const ITEM_CODE_RETRY_LIMIT = 5;

const getDepartmentAbbreviation = (departmentName) => {
    const normalizedName = String(departmentName || '').replace(/[^a-z0-9]/gi, '');
    const abbreviation = normalizedName.slice(0, 2);

    return abbreviation.charAt(0).toUpperCase() + abbreviation.slice(1).toLowerCase();
};

const getNextItemCode = async (department, subHeadCode) => {
    const [rows] = await sequelize.query(`
        SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(ItemCode, '/', -1) AS UNSIGNED)), 0) AS maxSequence
        FROM items
        WHERE ItemCode REGEXP '^[^/]+/[^/]+/[^/]+/[0-9]+$'
    `);
    const nextSequence = Number(rows[0]?.maxSequence || 0) + 1;
    const departmentCode = String(department.dept_id).padStart(2, '0');
    const normalizedSubHeadCode = String(subHeadCode).padStart(2, '0');
    const abbreviation = getDepartmentAbbreviation(department.dept_name);

    return `${departmentCode}/${normalizedSubHeadCode}/${abbreviation}/${String(nextSequence).padStart(4, '0')}`;
};

const createItemWithGeneratedCode = async (itemData, department, subHeadCode) => {
    for (let attempt = 0; attempt < ITEM_CODE_RETRY_LIMIT; attempt += 1) {
        const ItemCode = await getNextItemCode(department, subHeadCode);

        try {
            return await Item.create({ ItemCode, ...itemData });
        } catch (error) {
            if (error.name !== 'SequelizeUniqueConstraintError' || attempt === ITEM_CODE_RETRY_LIMIT - 1) {
                throw error;
            }
        }
    }

    throw new Error('Unable to generate a unique item code');
};

const getQuantityValue = (quantity, openingQty) => {
    const resolvedQuantity = quantity !== undefined && quantity !== null && quantity !== ''
        ? quantity
        : openingQty;
    return parseFloat(resolvedQuantity || 0);
};

const getDisplayQuantity = (item) => {
    const quantity = Number(item.Quantity);
    const openingQty = Number(item.OpeningQty);

    if (Number.isFinite(quantity) && quantity !== 0) {
        return quantity;
    }

    if (Number.isFinite(openingQty)) {
        return openingQty;
    }

    return 0;
};

exports.getItems = async (req, res) => {
    try {
        const { search, department, subHead, uom, page, limit, sortBy } = req.query;
        
        let whereClause = {};
        let orderClause = [['ItemCode', 'ASC']];
        
        // Search strictly by Item Name (ItemName)
        if (search && search.trim()) {
            whereClause.ItemName = {
                [Op.like]: `%${search.trim()}%`
            };
        }
        
        // Filters
        if (department && department !== 'ALL') {
            whereClause.DepartmentId = department;
        }
        if (subHead && subHead !== 'ALL') {
            whereClause.SubHeadCode = subHead;
        }
        if (uom && uom !== 'ALL') {
            whereClause.UOM = uom;
        }

        if (sortBy === 'code_desc') {
            orderClause = [['ItemCode', 'DESC']];
        } else if (sortBy === 'quantity_desc') {
            orderClause = [[sequelize.literal('COALESCE(NULLIF(`Quantity`, 0), `OpeningQty`)'), 'DESC'], ['ItemCode', 'ASC']];
        } else if (sortBy === 'quantity_asc') {
            orderClause = [[sequelize.literal('COALESCE(NULLIF(`Quantity`, 0), `OpeningQty`)'), 'ASC'], ['ItemCode', 'ASC']];
        }
        
        // Handle pagination
        if (page || limit) {
            const pageNum = parseInt(page, 10) || 1;
            const limitNum = parseInt(limit, 10) || 10;
            const offset = (pageNum - 1) * limitNum;

            const { count, rows } = await Item.findAndCountAll({
                where: whereClause,
                order: orderClause,
                limit: limitNum,
                offset: offset
            });

            return res.json({
                success: true,
                data: rows.map(item => ({
                    ...item.toJSON(),
                    Quantity: getDisplayQuantity(item)
                })),
                pagination: {
                    total: count,
                    page: pageNum,
                    totalPages: Math.ceil(count / limitNum),
                    limit: limitNum
                }
            });
        }

        // Default response when no pagination specified
        const items = await Item.findAll({
            where: whereClause,
            order: orderClause
        });

        res.json({
            success: true,
            data: items.map(item => ({
                ...item.toJSON(),
                Quantity: getDisplayQuantity(item)
            }))
        });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(errorStatus(error)).json({
            success: false,
            message: 'Error fetching items',
            error: error.message 
        });
    }
};

exports.addItem = async (req, res) => {
    try {
        const {
            ItemName, Category, Commodity, UnitRate, MinStockLevel,
            Quantity, OpeningQty, MaxStockLevel, OpenValue, Location, DepartmentId,
            HSNCode, SubHeadCode, UOM
        } = req.body;
        
        if (!ItemName || !DepartmentId || !SubHeadCode) {
            return res.status(400).json({
                success: false,
                message: 'Item Name, Department, and Sub Head are required'
            });
        }

        // Verify department and sub head exist
        const department = await Department.findByPk(DepartmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        const subHead = await SubHead.findByPk(SubHeadCode);
        if (!subHead) {
            return res.status(404).json({
                success: false,
                message: 'Sub Head not found'
            });
        }

        const resolvedQuantity = getQuantityValue(Quantity, OpeningQty);

        const newItem = await createItemWithGeneratedCode({
            ItemName: ItemName.trim(),
            Category: Category ? Category.trim() : null,
            Commodity: Commodity ? Commodity.trim() : null,
            UnitRate: UnitRate || 0,
            MinStockLevel: MinStockLevel || 0,
            OpeningQty: resolvedQuantity,
            Quantity: resolvedQuantity,
            MaxStockLevel: MaxStockLevel || 0,
            OpenValue: OpenValue || 0,
            Location: Location ? Location.trim() : null,
            DepartmentId: DepartmentId,
            HSNCode: HSNCode ? HSNCode.trim() : null,
            SubHeadCode: SubHeadCode,
            UOM: UOM ? UOM.trim() : null
        }, department, SubHeadCode);
        
        res.status(201).json({
            success: true,
            message: 'Item created successfully',
            data: newItem
        });
    } catch (error) {
        console.error('Error adding item:', error);

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                success: false,
                message: 'An item with the generated code already exists. Please try again.'
            });
        }

        res.status(errorStatus(error)).json({
            success: false, 
            message: 'Error adding item',
            error: error.message 
        });
    }
};

exports.updateItem = async (req, res) => {
    try {
        const code = req.query?.code ?? req.params.code;
        if (typeof code !== 'string' || !code.trim()) {
            return res.status(400).json({ success: false, message: 'A valid item code is required' });
        }
        const {
            ItemName, Category, Commodity, UnitRate, MinStockLevel,
            MaxStockLevel, OpenValue, Location, DepartmentId,
            HSNCode, SubHeadCode, UOM
        } = req.body;

        // ItemCode is a string: retain prefixes and leading zeroes.
        const item = await Item.findByPk(code);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        // Only update non-stock fields — preserve OpeningQty and Quantity
        // so that issue/receipt deductions are not accidentally overwritten
        await item.update({ 
            ItemName: ItemName ? ItemName.trim() : item.ItemName,
            Category: Category ? Category.trim() : null,
            Commodity: Commodity ? Commodity.trim() : null,
            UnitRate: UnitRate || 0,
            MinStockLevel: MinStockLevel || 0,
            MaxStockLevel: MaxStockLevel || 0,
            OpenValue: OpenValue || 0,
            Location: Location ? Location.trim() : null,
            DepartmentId: DepartmentId || item.DepartmentId,
            HSNCode: HSNCode ? HSNCode.trim() : null,
            SubHeadCode: SubHeadCode || item.SubHeadCode,
            UOM: UOM ? UOM.trim() : null
        });

        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(errorStatus(error)).json({
            success: false,
            message: 'Error updating item',
            error: error.message
        });
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const code = req.query?.code ?? req.params.code;
        if (typeof code !== 'string' || !code.trim()) {
            return res.status(400).json({ success: false, message: 'A valid item code is required' });
        }
        
        const item = await Item.findByPk(code);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        await preventReferencedDeletion('Item', item);

        await item.destroy();
        res.json({
            success: true,
            message: 'Item deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(errorStatus(error)).json({
            success: false,
            message: 'Error deleting item',
            error: error.message
        });
    }
};


exports.bulkUploadItems = async (req, res) => {
    try {
        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No items provided'
            });
        }

        let uploaded = 0;
        let failed = 0;
        const errors = [];

        for (let index = 0; index < items.length; index++) {
            try {
                const item = items[index];
                const { ItemName, DepartmentId, SubHeadCode } = item;

                // Validate required fields
                if (!ItemName || !DepartmentId || !SubHeadCode) {
                    failed++;
                    errors.push({
                        row: index + 2, // +2 for header and 1-based indexing
                        message: 'Missing required fields: ItemName, DepartmentId, SubHeadCode'
                    });
                    continue;
                }

                // Verify department exists
                const department = await Department.findByPk(DepartmentId);
                if (!department) {
                    failed++;
                    errors.push({
                        row: index + 2,
                        message: `Department ID ${DepartmentId} not found`
                    });
                    continue;
                }

                // Verify sub head exists
                const subHead = await SubHead.findByPk(SubHeadCode);
                if (!subHead) {
                    failed++;
                    errors.push({
                        row: index + 2,
                        message: `SubHead Code ${SubHeadCode} not found`
                    });
                    continue;
                }

                // Create item
                await createItemWithGeneratedCode({
                    ItemName: ItemName.trim(),
                    Category: item.Category ? item.Category.trim() : null,
                    Commodity: item.Commodity ? item.Commodity.trim() : null,
                    UnitRate: item.UnitRate || 0,
                    MinStockLevel: item.MinStockLevel || 0,
                    OpeningQty: getQuantityValue(item.Quantity, item.OpeningQty),
                    Quantity: getQuantityValue(item.Quantity, item.OpeningQty),
                    MaxStockLevel: item.MaxStockLevel || 0,
                    OpenValue: item.OpenValue || 0,
                    Location: item.Location ? item.Location.trim() : null,
                    DepartmentId: DepartmentId,
                    HSNCode: item.HSNCode ? item.HSNCode.trim() : null,
                    SubHeadCode: SubHeadCode,
                    UOM: item.UOM ? item.UOM.trim() : null
                }, department, SubHeadCode);

                uploaded++;
            } catch (error) {
                failed++;
                errors.push({
                    row: index + 2,
                    message: error.message
                });
            }
        }

        res.status(200).json({
            success: true,
            message: `Bulk upload completed. ${uploaded} items created, ${failed} failed.`,
            total: items.length,
            uploaded: uploaded,
            failed: failed,
            errors: errors
        });
    } catch (error) {
        console.error('Error in bulk upload:', error);
        res.status(errorStatus(error)).json({
            success: false,
            message: 'Error processing bulk upload',
            error: error.message
        });
    }
};
