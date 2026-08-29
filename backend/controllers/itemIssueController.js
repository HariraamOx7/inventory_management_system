const ItemIssue = require('../models/ItemIssue');
const ItemIssueDetail = require('../models/ItemIssueDetail');
const Department = require('../models/Department');
const ItemMaster = require('../models/ItemMaster');
const Item = require('../models/Item');
const sequelize = require('../config/db');

// Get effective stock — same logic as Items page (getDisplayQuantity)
// Prefers Quantity if non-zero, else falls back to OpeningQty
const getEffectiveStock = (item) => {
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

// Get last issue number
exports.getLastIssueNo = async (req, res) => {
  try {
    const lastIssue = await ItemIssue.findOne({
      order: [['IssueNo', 'DESC']]
    });

    res.json({
      success: true,
      data: { lastIssueNo: lastIssue ? lastIssue.IssueNo : 0 }
    });
  } catch (error) {
    console.error('Error fetching last issue number:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching issue number',
      error: error.message
    });
  }
};

// Get all departments
exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.findAll({
      attributes: ['dept_id', 'dept_name'],
      order: [['dept_name', 'ASC']]
    });

    res.json({
      success: true,
      data: departments.map(d => ({ id: d.dept_id, name: d.dept_name }))
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching departments',
      error: error.message
    });
  }
};

// Existing endpoint kept (if needed elsewhere)
exports.getItems = async (req, res) => {
  try {
    const items = await ItemMaster.findAll({
      attributes: ['ItemCode', 'ItemName', 'UOM'],
      order: [['ItemName', 'ASC']]
    });

    res.json({
      success: true,
      data: items.map(item => ({
        code: item.ItemCode,
        name: item.ItemName,
        uom: item.UOM
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

// NEW: Get items by department with stock + defaults for issue row
exports.getItemsByDepartment = async (req, res) => {
  try {
    const { department } = req.query;

    if (!department || !department.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Department is required'
      });
    }

    const dept = await Department.findOne({
      where: { dept_name: department.trim() },
      attributes: ['dept_id', 'dept_name']
    });

    if (!dept) {
      return res.json({
        success: true,
        data: []
      });
    }

    const items = await Item.findAll({
      where: { DepartmentId: dept.dept_id },
      attributes: ['ItemCode', 'ItemName', 'Quantity', 'OpeningQty', 'UOM'],
      order: [['ItemName', 'ASC']]
    });

    res.json({
      success: true,
      data: items.map(it => ({
        ItemCode: it.ItemCode,
        ItemName: it.ItemName,
        Qty: 0,
        OpeningQty: getEffectiveStock(it),
        UOM: it.UOM || '',
        EmpName: ''
      }))
    });
  } catch (error) {
    console.error('Error fetching department items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department items',
      error: error.message
    });
  }
};

// Get all item issues
exports.getItemIssues = async (req, res) => {
  try {
    const issues = await ItemIssue.findAll({
      include: [{ model: ItemIssueDetail, as: 'details' }],
      order: [['IssueNo', 'DESC']]
    });

    res.json({
      success: true,
      data: issues
    });
  } catch (error) {
    console.error('Error fetching item issues:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching item issues',
      error: error.message
    });
  }
};

// Create item issue with stock deduction
exports.createItemIssue = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { IssueDate, IndentNo, Department: departmentName, Approval, Remarks, items } = req.body;

    if (!departmentName || !items || items.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Department and items are required'
      });
    }

    // Only issue rows where Qty > 0
    const issueItems = items.filter(i => Number(i.Qty) > 0);

    if (issueItems.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'At least one item with Qty > 0 is required'
      });
    }

    const dept = await Department.findOne({
      where: { dept_name: departmentName.trim() },
      attributes: ['dept_id'],
      transaction: t
    });

    if (!dept) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    const newIssue = await ItemIssue.create({
      IssueDate: IssueDate || new Date(),
      IndentNo: IndentNo ? IndentNo.trim() : null,
      Department: departmentName.trim(),
      Approval: Approval ? Approval.trim() : null,
      Remarks: Remarks ? Remarks.trim() : null
    }, { transaction: t });

    for (const row of issueItems) {
      const qty = Number(row.Qty || 0);

      if (qty <= 0) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Qty must be greater than 0'
        });
      }

      const item = await Item.findOne({
        where: row.ItemCode
          ? { ItemCode: row.ItemCode, DepartmentId: dept.dept_id }
          : { ItemName: row.ItemName, DepartmentId: dept.dept_id },
        transaction: t
      });

      if (!item) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: 'Item not found in selected department: ' + (row.ItemName || row.ItemCode)
        });
      }

      const currentStock = getEffectiveStock(item);

      // Allow issuing the full balance, including a single remaining unit.
      if (qty > currentStock) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Qty for ' + item.ItemName + ' cannot exceed stock (' + currentStock + ')'
        });
      }

      await ItemIssueDetail.create({
        IssueNo: newIssue.IssueNo,
        ItemName: item.ItemName,
        CatNo: row.CatNo || null,
        DrawNo: row.DrawNo || null,
        Qty: qty,
        OpeningQty: currentStock,
        UOM: item.UOM || row.UOM || null,
        EmpName: row.EmpName || null
      }, { transaction: t });

      await item.update(
        { OpeningQty: currentStock - qty, Quantity: currentStock - qty },
        { transaction: t }
      );
    }

    await t.commit();
    res.status(201).json({
      success: true,
      message: 'Item Issue created successfully',
      data: newIssue
    });
  } catch (error) {
    await t.rollback();
    console.error('Error creating item issue:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating item issue',
      error: error.message
    });
  }
};

// Update item issue with stock restore + re-deduct
exports.updateItemIssue = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { issueNo } = req.params;

    const issue = await ItemIssue.findByPk(issueNo, { transaction: t });    
    
    const { IssueDate, IndentNo, Department: departmentName, Approval, Remarks, items } = req.body;
    const deptName = (departmentName || issue.Department || '').trim();
    
    if (!issue) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Item Issue not found'
      });
    }

    const dept = await Department.findOne({
      where: { dept_name: deptName },
      attributes: ['dept_id'],
      transaction: t
    });

    if (!dept) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    await issue.update({
      IssueDate: IssueDate || issue.IssueDate,
      IndentNo: IndentNo ? IndentNo.trim() : issue.IndentNo,
      Department: deptName,
      Approval: Approval ? Approval.trim() : issue.Approval,
      Remarks: Remarks ? Remarks.trim() : issue.Remarks
    }, { transaction: t });

    const existingDetails = await ItemIssueDetail.findAll({
      where: { IssueNo: issueNo },
      transaction: t
    });

    // Restore previously deducted stock
    for (const d of existingDetails) {
      const item = await Item.findOne({
        where: {
          ItemName: d.ItemName,
          DepartmentId: dept.dept_id
        },
        transaction: t
      });

      if (item) {
        const restored = getEffectiveStock(item) + Number(d.Qty || 0);
        await item.update({ OpeningQty: restored, Quantity: restored }, { transaction: t });
      }
    }

    await ItemIssueDetail.destroy({
      where: { IssueNo: issueNo },
      transaction: t
    });

    const issueItems = (items || []).filter(i => Number(i.Qty) > 0);

    if (issueItems.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'At least one item with Qty > 0 is required'
      });
    }

    for (const row of issueItems) {
      const qty = Number(row.Qty || 0);

      if (qty <= 0) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Qty must be greater than 0'
        });
      }
      const item = await Item.findOne({
        where: row.ItemCode
          ? { ItemCode: row.ItemCode, DepartmentId: dept.dept_id }
          : { ItemName: row.ItemName, DepartmentId: dept.dept_id },
        transaction: t
      });

      if (!item) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: 'Item not found in selected department: ' + (row.ItemName || row.ItemCode)
        });
      }

      const currentStock = getEffectiveStock(item);

      // Allow issuing the full balance, including a single remaining unit.
      if (qty > currentStock) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Qty for ' + item.ItemName + ' cannot exceed stock (' + currentStock + ')'
        });
      }

      await ItemIssueDetail.create({
        IssueNo: issueNo,
        ItemName: item.ItemName,
        CatNo: row.CatNo || null,
        DrawNo: row.DrawNo || null,
        Qty: qty,
        OpeningQty: currentStock,
        UOM: item.UOM || row.UOM || null,
        EmpName: row.EmpName || null
      }, { transaction: t });

      await item.update(
        { OpeningQty: currentStock - qty, Quantity: currentStock - qty },
        { transaction: t }
      );
    }

    await t.commit();
    res.json({
      success: true,
      message: 'Item Issue updated successfully',
      data: issue
    });
  } catch (error) {
    await t.rollback();
    console.error('Error updating item issue:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating item issue',
      error: error.message
    });
  }
};

// Delete item issue with stock restoration
exports.deleteItemIssue = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { issueNo } = req.params;

    const issue = await ItemIssue.findByPk(issueNo, { transaction: t });
    if (!issue) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Item Issue not found'
      });
    }

    // Look up the department to find items by DepartmentId
    const dept = await Department.findOne({
      where: { dept_name: (issue.Department || '').trim() },
      attributes: ['dept_id'],
      transaction: t
    });

    // Restore stock for each issued item before deleting
    const existingDetails = await ItemIssueDetail.findAll({
      where: { IssueNo: issueNo },
      transaction: t
    });

    if (dept) {
      for (const d of existingDetails) {
        const item = await Item.findOne({
          where: {
            ItemName: d.ItemName,
            DepartmentId: dept.dept_id
          },
          transaction: t
        });

        if (item) {
          const restored = getEffectiveStock(item) + Number(d.Qty || 0);
          await item.update(
            { OpeningQty: restored, Quantity: restored },
            { transaction: t }
          );
        }
      }
    }

    await ItemIssueDetail.destroy({ where: { IssueNo: issueNo }, transaction: t });
    await issue.destroy({ transaction: t });

    await t.commit();
    res.json({
      success: true,
      message: 'Item Issue deleted successfully'
    });
  } catch (error) {
    await t.rollback();
    console.error('Error deleting item issue:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting item issue',
      error: error.message
    });
  }
};
