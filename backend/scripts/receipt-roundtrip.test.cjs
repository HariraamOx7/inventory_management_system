// Uses a disposable schema; never writes to the configured application database.
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });
const response = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });

(async () => {
  const database = `stores_rehearsal_receipt_${Date.now()}`;
  const admin = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  let sequelize, created = false;
  try {
    await admin.query(`CREATE DATABASE \`${database}\``);
    created = true;
    process.env.DB_NAME = database;
    const models = require('../models');
    ({ sequelize } = models);
    await sequelize.sync();
    const { Supplier, Item, PurchaseOrder, PurchaseOrderDetail, GateInward, GateInwardDetail, Receipt, ReceiptDetail } = models;
    const controller = require('../controllers/receiptController');
    await Supplier.create({ PartyCode: 'TEST', AccountName: 'Receipt test' });
    await Item.create({ ItemCode: '001/BELT', ItemName: 'Flat belt' });
    await PurchaseOrder.create({ OrderNo: 1065, PartyCode: 'TEST', OrderDate: '2026-10-30', Status: 'Completed' });
    await PurchaseOrderDetail.create({ OrderNo: 1065, ItemCode: '001/BELT', Qty: 3, UnitRate: 12.5 });
    for (const [InwardNo, ReceivedQty] of [[1062, 1], [1063, 2]]) {
      await GateInward.create({ InwardNo, OrderNo: 1065, PartyCode: 'TEST', InwardDate: '2026-10-30' });
      await GateInwardDetail.create({ InwardNo, OrderNo: 1065, ItemCode: '001/BELT', ReceivedQty });
    }
    const body = { PartyCode: 'TEST', GateInwardNo: 1062, OrderNo: 1065, Total: 37.5, GrandTotal: 37.5, items: [{ ItemCode: '001/BELT', Qty: 3, UnitRate: 12.5 }] };
    let res = response();
    await controller.createReceipt({ body }, res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    const grn = res.body.data.GRNNo;
    res = response();
    await controller.getReceipts({}, res);
    let saved = res.body.data.find(r => r.GRNNo === grn);
    assert.equal(Number(saved.OrderNo), 1065);
    assert.equal(saved.details.length, 1);
    assert.equal(saved.details[0].ItemCode, '001/BELT');
    assert.equal(saved.details[0].ItemName, 'Flat belt');
    assert.equal(Number(saved.details[0].Qty), 3);
    assert.equal(saved.gateInwards.length, 2);
    console.log('PASS create/list preserves PO, product, quantity, and both batches');

    await ReceiptDetail.destroy({ where: { GRNNo: grn } });
    res = response();
    await controller.getReceipts({}, res);
    saved = res.body.data.find(r => r.GRNNo === grn);
    assert.equal(saved.detailsRecovered, true);
    assert.equal(Number(saved.OrderNo), 1065);
    assert.equal(saved.details[0].Qty, 3);
    assert.equal(saved.details[0].TotalAmount, 37.5);
    assert.equal(await ReceiptDetail.count({ where: { GRNNo: grn } }), 0);
    res = response();
    await controller.updateReceipt({ params: { grnNo: grn }, body: { ...body, items: saved.details } }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    res = response();
    await controller.getReceipts({}, res);
    saved = res.body.data.find(r => r.GRNNo === grn);
    assert.ok(!saved.detailsRecovered);
    assert.equal(saved.details.length, 1);
    console.log('PASS header-only receipt recovers all batches and persists on save');

    res = response();
    await controller.updateReceipt({ params: { grnNo: grn }, body: { ...body, items: [] } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(await ReceiptDetail.count({ where: { GRNNo: grn } }), 1);
    console.log('PASS empty update cannot remove saved products');

    ReceiptDetail.addHook('beforeCreate', 'failReceiptTest', () => { throw new Error('Simulated detail failure'); });
    const originalError = console.error;
    console.error = () => {};
    try {
      res = response();
      await controller.updateReceipt({ params: { grnNo: grn }, body: { ...body, InvoiceNo: 'must rollback' } }, res);
      assert.equal(res.statusCode, 500);
      assert.equal((await Receipt.findByPk(grn)).InvoiceNo, null);
      assert.equal(await ReceiptDetail.count({ where: { GRNNo: grn } }), 1);
      await ReceiptDetail.destroy({ where: { GRNNo: grn } });
      await Receipt.destroy({ where: { GRNNo: grn } });
      res = response();
      await controller.createReceipt({ body }, res);
      assert.equal(res.statusCode, 500);
      assert.equal(await Receipt.count(), 0);
      assert.equal(await ReceiptDetail.count(), 0);
    } finally {
      console.error = originalError;
      ReceiptDetail.removeHook('beforeCreate', 'failReceiptTest');
    }
    console.log('PASS failed detail writes roll back create and update');
  } finally {
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
