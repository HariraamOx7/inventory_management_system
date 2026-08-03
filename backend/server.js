// backend/server.js
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/db');
// Import models and set up associations BEFORE using them
const {
  GateInward,
  GateInwardDetail,
  PurchaseOrder,
  PurchaseOrderDetail,
  Receipt,
  ReceiptDetail,
  SubHead,
  Department
} = require('./models/index');

const app = express();

const departmentRoutes = require('./routes/departmentRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const storeRoutes = require('./routes/storeMasterRoutes');
const prodHeadRoutes = require('./routes/prodHeadRoutes');
const subHeadRoutes = require('./routes/subHeadRoutes');
const itemRoutes = require('./routes/itemRoutes');
const uomRoutes = require('./routes/uomRoutes');
const itemMasterRoutes = require('./routes/itemMasterRoutes');
const partyMasterRoutes = require('./routes/partyMasterRoutes');
const purchaseTypeRoutes = require('./routes/purchaseTypeRoutes');
const stateRoutes = require('./routes/stateRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const gateInwardRoutes = require('./routes/gateInwardRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const billEntryRoutes = require('./routes/billEntryRoutes');
const itemIssueRoutes = require('./routes/itemIssueRoutes');
const gatePassOutRoutes = require('./routes/gatePassOutRoutes');
const gatePassInRoutes = require('./routes/gatePassInRoutes');
const cancelOrderRoutes = require('./routes/cancelOrderRoutes');
const billVerifyRoutes = require('./routes/billVerifyRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/product-heads', prodHeadRoutes);
app.use('/api/sub-heads', subHeadRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/uoms', uomRoutes);
app.use('/api/item-masters', itemMasterRoutes);
app.use('/api/parties', partyMasterRoutes);
app.use('/api/states', stateRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/gate-inwards', gateInwardRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/bill-entries', billEntryRoutes);
app.use('/api/item-issues', itemIssueRoutes);
app.use('/api/gate-pass-outs', gatePassOutRoutes);
app.use('/api/gate-pass-ins', gatePassInRoutes);
app.use('/api/cancel-orders', cancelOrderRoutes);
app.use('/api/bill-verify', billVerifyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', purchaseTypeRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
    });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection established');

        // Use { force: true } to drop and recreate all tables
        await sequelize.sync({ alter: true });

        console.log('Database synchronized');

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Unable to start server:', error);
        process.exit(1);
    }
};

startServer();