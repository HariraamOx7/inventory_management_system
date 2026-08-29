const Item = require('../models/Item');
const Department = require('../models/Department');
const SubHead = require('../models/SubHead');
const { Op } = require('sequelize');
const sequelize = require('../config/db');

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
        res.status(500).json({ 
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

        const newItem = await Item.create({ 
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
        });
        
        res.status(201).json({
            success: true,
            message: 'Item created successfully',
            data: newItem
        });
    } catch (error) {
        console.error('Error adding item:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error adding item',
            error: error.message 
        });
    }
};

exports.updateItem = async (req, res) => {
    try {
        const { code } = req.params;
        const {
            ItemName, Category, Commodity, UnitRate, MinStockLevel,
            MaxStockLevel, OpenValue, Location, DepartmentId,
            HSNCode, SubHeadCode, UOM
        } = req.body;

        // Convert code to integer
        const itemCode = parseInt(code);
        
        const item = await Item.findByPk(itemCode);
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
        res.status(500).json({
            success: false,
            message: 'Error updating item',
            error: error.message
        });
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const { code } = req.params;
        const decodedCode = decodeURIComponent(code);
        
        const item = await Item.findByPk(decodedCode);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        await item.destroy();
        res.json({
            success: true,
            message: 'Item deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({
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
                await Item.create({
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
                });

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
        res.status(500).json({
            success: false,
            message: 'Error processing bulk upload',
            error: error.message
        });
    }
};