const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const sequelize = require('./config/db');
const initAdmin = require('./config/initAdmin');

// Import models and set up associations BEFORE using them
const {
  GateInward,
  GateInwardDetail,
  PurchaseOrder,
  PurchaseOrderDetail,
  Receipt,
  ReceiptDetail,
  SubHead,
  Department,
  User
} = require('./models/index');

// Import Middlewares
const { auth } = require('./middleware/auth');
const { apiLimiter, heavyOpsLimiter } = require('./middleware/rateLimiter');

// Import Routes
const authRoutes = require('./routes/authRoutes');
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

const app = express();

// 1. Security Headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // Allows flexible API usage across dev & prod clients
}));

// 2. CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'https://krexports.org'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Sane Body Parser Limits (protection against large payload DoS)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// 4. Rate Limiting for General API
app.use('/api/', apiLimiter);

// ── Authentication & Public Endpoints ──
app.use('/api/auth', authRoutes);

// ── Protected Business API Routes (Requires valid JWT Token) ──
app.use('/api/dashboard', auth, dashboardRoutes);
app.use('/api/departments', auth, departmentRoutes);
app.use('/api/suppliers', auth, supplierRoutes);
app.use('/api/stores', auth, storeRoutes);
app.use('/api/product-heads', auth, prodHeadRoutes);
app.use('/api/sub-heads', auth, subHeadRoutes);
app.use('/api/items', auth, itemRoutes);
app.use('/api/uoms', auth, uomRoutes);
app.use('/api/item-masters', auth, itemMasterRoutes);
app.use('/api/parties', auth, partyMasterRoutes);
app.use('/api/states', auth, stateRoutes);
app.use('/api/purchase-orders', auth, purchaseOrderRoutes);
app.use('/api/gate-inwards', auth, gateInwardRoutes);
app.use('/api/receipts', auth, receiptRoutes);
app.use('/api/bill-entries', auth, billEntryRoutes);
app.use('/api/item-issues', auth, itemIssueRoutes);
app.use('/api/gate-pass-outs', auth, gatePassOutRoutes);
app.use('/api/gate-pass-ins', auth, gatePassInRoutes);
app.use('/api/cancel-orders', auth, cancelOrderRoutes);
app.use('/api/bill-verify', auth, billVerifyRoutes);
app.use('/api/reports', auth, heavyOpsLimiter, reportRoutes);
app.use('/api/purchase-types', auth, purchaseTypeRoutes);

// 5. Global Error Handler (Sanitized in production)
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);

  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && isProduction
      ? 'An unexpected internal server error occurred.'
      : err.message || 'Internal server error',
    ...(isProduction ? {} : { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log(' Database connection established');

    await sequelize.sync();
    console.log(' Database synchronized');

    // Auto-initialize default admin account if table is empty
    await initAdmin();

    app.listen(PORT, () => {
      console.log(` Secure Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(' Unable to start server:', error);
    process.exit(1);
  }
};

startServer();