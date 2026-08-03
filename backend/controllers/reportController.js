const ExcelJS = require('exceljs');
const Item = require('../models/Item');
const Department = require('../models/Department');

exports.exportItemWiseStock = async (req, res) => {
  try {
    const departments = await Department.findAll({
      attributes: ['dept_id', 'dept_name'],
      order: [['dept_name', 'ASC']]
    });

    const items = await Item.findAll({
      attributes: ['ItemCode', 'ItemName', 'DepartmentId', 'OpeningQty', 'UnitRate'],
      order: [['DepartmentId', 'ASC'], ['ItemName', 'ASC']]
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Item Wise Stock');

    sheet.columns = [
      { header: 'Department Name', key: 'departmentName', width: 28 },
      { header: 'Item Code', key: 'itemCode', width: 14 },
      { header: 'Item Name', key: 'itemName', width: 32 },
      { header: 'Quantity', key: 'quantity', width: 14 },
      { header: 'Rate', key: 'rate', width: 14 },
      { header: 'Value', key: 'value', width: 16 }
    ];

    const deptMap = new Map(departments.map(d => [d.dept_id, d.dept_name]));
    const grouped = new Map();

    for (const item of items) {
      const deptId = item.DepartmentId || 0;
      if (!grouped.has(deptId)) grouped.set(deptId, []);
      grouped.get(deptId).push(item);
    }

    for (const dept of departments) {
      const deptItems = grouped.get(dept.dept_id) || [];
      if (deptItems.length === 0) continue;

      // Department heading row
      sheet.addRow({
        departmentName: dept.dept_name,
        itemCode: '',
        itemName: '',
        quantity: '',
        rate: '',
        value: ''
      });

      // Department item rows
      for (const item of deptItems) {
        const qty = Number(item.OpeningQty || 0);
        const rate = Number(item.UnitRate || 0);

        sheet.addRow({
          departmentName: dept.dept_name,
          itemCode: item.ItemCode,
          itemName: item.ItemName,
          quantity: qty,
          rate: rate,
          value: qty * rate
        });
      }

      sheet.addRow({}); // blank separator row
    }

    // Header style
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=item-wise-stock-report.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting item wise stock report:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting item wise stock report',
      error: error.message
    });
  }
};