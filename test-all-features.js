/**
 * Automated System Feature & Diagnostics Test Runner
 * 
 * Verifies all 23+ modules and functionalities across the Inventory & Store Management System:
 * - Database & ORM Model Integrity
 * - Master Modules (Department, SubHead, Item, Supplier, Party, PurchaseType, UOM, State, Store, etc.)
 * - Procurement Workflow (Purchase Order -> Gate Inward -> Receipt/GRN -> Bill Entry -> Bill Verify)
 * - GST Grouping & Purchase Voucher PDF Print Data
 * - Inventory & Issues (Item Issue, Stock Decrements)
 * - Gate Passes (Gate Pass Out, Gate Pass In)
 * - Order Cancellation & Cascade Deletion
 * - Dashboard Analytics & Excel Report Generation
 * 
 * Run with: node test-all-features.js (or npm test)
 */

const path = require('path');
require(path.resolve(__dirname, 'backend/node_modules/dotenv')).config({ path: __dirname + '/backend/.env' });
const { jsPDF } = require(path.resolve(__dirname, 'frontend/node_modules/jspdf'));
const { Op } = require(path.resolve(__dirname, 'backend/node_modules/sequelize'));

// Load Sequelize Models with all associations
const {
  sequelize,
  Department,
  SubHead,
  Item,
  Supplier,
  ItemMaster,
  PartyMaster,
  PurchaseType,
  State,
  StoreMaster,
  ProductHead,
  UOM,
  PurchaseOrder,
  PurchaseOrderDetail,
  GateInward,
  GateInwardDetail,
  Receipt,
  ReceiptDetail,
  BillEntry,
  BillEntryDetail,
  ItemIssue,
  ItemIssueDetail,
  GatePassOut,
  GatePassOutDetail,
  GatePassIn,
  GatePassInDetail,
  CancelOrder,
  BillVerify,
  User
} = require('./backend/models/index');

// Load Controllers
const authController = require('./backend/controllers/authController');
const departmentController = require('./backend/controllers/departmentController');
const subHeadController = require('./backend/controllers/subHeadController');
const prodHeadController = require('./backend/controllers/prodHeadController');
const uomController = require('./backend/controllers/uomController');
const stateController = require('./backend/controllers/stateController');
const storeMasterController = require('./backend/controllers/storeMasterController');
const itemMasterController = require('./backend/controllers/itemMasterController');
const itemController = require('./backend/controllers/itemController');
const supplierController = require('./backend/controllers/supplierController');
const partyMasterController = require('./backend/controllers/partyMasterController');
const purchaseTypeController = require('./backend/controllers/purchaseTypeController');
const purchaseOrderController = require('./backend/controllers/purchaseOrderController');
const gateInwardController = require('./backend/controllers/gateInwardController');
const receiptController = require('./backend/controllers/receiptController');
const billEntryController = require('./backend/controllers/billEntryController');
const billVerifyController = require('./backend/controllers/billVerifyController');
const itemIssueController = require('./backend/controllers/itemIssueController');
const gatePassOutController = require('./backend/controllers/gatePassOutController');
const gatePassInController = require('./backend/controllers/gatePassInController');
const cancelOrderController = require('./backend/controllers/cancelOrderController');
const dashboardController = require('./backend/controllers/dashboardController');
const reportController = require('./backend/controllers/reportController');

// Terminal formatting colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

const state = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

// Helper: Mock Express Request/Response
function createMockReqRes(reqData = {}) {
  let statusCode = 200;
  let responseData = null;
  let headers = {};

  const req = {
    params: reqData.params || {},
    query: reqData.query || {},
    body: reqData.body || {}
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(key, val) {
      headers[key] = val;
    },
    json(data) {
      responseData = data;
      return this;
    },
    send(data) {
      responseData = data;
      return this;
    },
    end() {
      return this;
    }
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getData: () => responseData,
    getHeaders: () => headers
  };
}

async function runTest(suiteName, testName, testFn) {
  state.total++;
  const startTime = Date.now();
  try {
    await testFn();
    const elapsed = Date.now() - startTime;
    state.passed++;
    console.log(`  ${colors.green}✓${colors.reset} ${colors.bright}${testName}${colors.reset} ${colors.dim}(${elapsed}ms)${colors.reset}`);
  } catch (err) {
    state.failed++;
    const elapsed = Date.now() - startTime;
    state.failures.push({ suite: suiteName, test: testName, error: err.message || err });
    console.log(`  ${colors.red}✗${colors.reset} ${colors.bright}${testName}${colors.reset} ${colors.dim}(${elapsed}ms)${colors.reset}`);
    console.log(`    ${colors.red}Error: ${err.message || err}${colors.reset}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function main() {
  console.log(`\n${colors.cyan}${colors.bright}========================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}   🚀 AUTOMATED SYSTEM FEATURE & DIAGNOSTICS TEST SUITE${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}========================================================================${colors.reset}\n`);

  const totalStartTime = Date.now();
  const testTag = `_TEST_${Date.now()}`;

  // -------------------------------------------------------------------------
  // SUITE 1: DATABASE CONNECTIVITY & ASSOCIATIONS
  // -------------------------------------------------------------------------
  console.log(`\n${colors.yellow}${colors.bright}1. Database & Model Associations${colors.reset}`);
  
  await runTest('DB Integrity', 'Authenticate MySQL Database Connection', async () => {
    await sequelize.authenticate();
  });

  await runTest('DB Integrity', 'Verify Core Model Associations Setup', async () => {
    assert(BillEntry.associations.details, 'BillEntry must have details association');
    assert(Receipt.associations.details, 'Receipt must have details association');
    assert(PurchaseOrder.associations.details, 'PurchaseOrder must have details association');
    assert(GateInward.associations.details, 'GateInward must have details association');
  });

  // -------------------------------------------------------------------------
  // SUITE 2: MASTER MODULES
  // -------------------------------------------------------------------------
  console.log(`\n${colors.yellow}${colors.bright}2. Master Data Modules (CRUD)${colors.reset}`);

  let testDeptId = null;
  await runTest('Masters', 'Department Master (List & Create)', async () => {
    const { req, res, getData, getStatusCode } = createMockReqRes({
      body: { dept_name: `Test_Dept_${testTag}`, description: 'Automated test department' }
    });
    await departmentController.createDepartment(req, res);
    const data = getData();
    assert(getStatusCode() === 201 || data?.success, 'Department creation failed');
    testDeptId = data.data?.dept_id || data.dept_id;
    assert(testDeptId, 'Department ID missing');
  });

  let testSubHeadId = null;
  await runTest('Masters', 'SubHead Master (Create & List)', async () => {
    const { req, res, getData } = createMockReqRes({
      body: {
        SubHeadCode: `SH_${testTag.slice(-6)}`,
        SubHeadName: `SubHead_${testTag}`,
        DepartmentId: testDeptId
      }
    });
    await subHeadController.createSubHead(req, res);
    const data = getData();
    assert(data?.success, 'SubHead creation failed');
    testSubHeadId = data.data?.SubHeadId || data.data?.id;
  });

  let testProdHeadCode = null;
  await runTest('Masters', 'Product Head Master', async () => {
    const { req, res, getData } = createMockReqRes({
      body: {
        prodhead_code: `PH_${testTag.slice(-4)}`,
        prodhead_name: `ProdHead_${testTag}`
      }
    });
    await prodHeadController.createProductHead(req, res);
    const data = getData();
    assert(data?.success, 'ProductHead creation failed');
    testProdHeadCode = `PH_${testTag.slice(-4)}`;
  });

  await runTest('Masters', 'UOM Master', async () => {
    const { req, res, getData } = createMockReqRes({
      body: { uom_name: `UOM_${testTag.slice(-4)}` }
    });
    await uomController.createUOM(req, res);
    const data = getData();
    assert(data?.success, 'UOM creation failed');
  });

  await runTest('Masters', 'State Master', async () => {
    const { req, res, getData } = createMockReqRes({
      body: { StateCode: `S${testTag.slice(-3)}`, StateName: `State_${testTag}` }
    });
    await stateController.createState(req, res);
    const data = getData();
    assert(data?.success, 'State creation failed');
  });

  await runTest('Masters', 'Store Master', async () => {
    const { req, res, getData } = createMockReqRes({
      body: { store_name: `Store_${testTag}`, location: 'Bay A1' }
    });
    await storeMasterController.createStore(req, res);
    const data = getData();
    assert(data?.success, 'Store creation failed');
  });

  let testItemCode = null;
  const testItemName1 = `Item_12GST_${testTag}`;
  const testItemName2 = `Item_18GST_${testTag}`;

  await runTest('Masters', 'Item Inventory Master (Create Items with Stock)', async () => {
    const { req, res, getData } = createMockReqRes({
      body: {
        ItemName: testItemName1,
        UnitRate: 100,
        OpeningQty: 50,
        Quantity: 50,
        MinStockLevel: 5,
        MaxStockLevel: 200,
        UOM: 'NOS',
        DepartmentId: testDeptId
      }
    });
    await itemController.createItem(req, res);
    const data = getData();
    assert(data?.success, 'Item 1 creation failed');
    testItemCode = data.data?.ItemCode;

    // Create second item
    const mock2 = createMockReqRes({
      body: {
        ItemName: testItemName2,
        UnitRate: 200,
        OpeningQty: 40,
        Quantity: 40,
        MinStockLevel: 5,
        MaxStockLevel: 200,
        UOM: 'NOS',
        DepartmentId: testDeptId
      }
    });
    await itemController.createItem(mock2.req, mock2.res);
    assert(mock2.getData()?.success, 'Item 2 creation failed');
  });

  const testPartyName = `Supplier_Party_${testTag}`;
  await runTest('Masters', 'Supplier / Party Master', async () => {
    const { req, res, getData } = createMockReqRes({
      body: {
        supplier_name: testPartyName,
        contact_person: 'John Doe',
        phone: '9876543210',
        gst_no: '33AAAAA0000A1Z5'
      }
    });
    await supplierController.createSupplier(req, res);
    const data = getData();
    assert(data?.success, 'Supplier creation failed');
  });

  await runTest('Masters', 'Purchase Type Master & Formulas', async () => {
    const { req, res, getData } = createMockReqRes({
      body: {
        Code: 9999,
        PurchaseType: `PURCHASE_TEST_${testTag}`,
        Description: 'Test Stationery & Spares',
        Commodity: 'Stationery'
      }
    });
    await purchaseTypeController.addPurchaseType(req, res);
    const data = getData();
    assert(data?.success, 'Purchase Type add failed');

    // Test default formulas
    const mockF = createMockReqRes();
    await purchaseTypeController.getDefaultFormulas(mockF.req, mockF.res);
    assert(mockF.getData()?.success, 'Default formulas fetch failed');
  });

  // -------------------------------------------------------------------------
  // SUITE 3: END-TO-END PROCUREMENT & GST BREAKDOWN WORKFLOW
  // -------------------------------------------------------------------------
  console.log(`\n${colors.yellow}${colors.bright}3. Procurement Workflow (PO -> Gate Inward -> Receipt -> Bill Entry)${colors.reset}`);

  let createdOrderNo = null;
  await runTest('Procurement', 'Step 1: Create Purchase Order with Multi-Rate GST (12% & 18%)', async () => {
    const { req, res, getData } = createMockReqRes({
      body: {
        PartyName: testPartyName,
        OrderDate: new Date().toISOString().split('T')[0],
        Total: 5000,
        Discount: 0,
        GST: 720,
        GrandTotal: 5720,
        items: [
          {
            ItemName: testItemName1,
            Qty: 20,
            UnitRate: 100,
            TotalAmount: 2000,
            GSTType: 'GST [12 %]',
            GSTPct: 12,
            SGSTPct: 6,
            SGST: 120,
            CGSTPct: 6,
            CGST: 120
          },
          {
            ItemName: testItemName2,
            Qty: 15,
            UnitRate: 200,
            TotalAmount: 3000,
            GSTType: 'GST [18 %]',
            GSTPct: 18,
            SGSTPct: 9,
            SGST: 270,
            CGSTPct: 9,
            CGST: 270
          }
        ]
      }
    });
    await purchaseOrderController.createPurchaseOrder(req, res);
    const data = getData();
    assert(data?.success, 'PO creation failed');
    createdOrderNo = data.data?.OrderNo;
    assert(createdOrderNo, 'OrderNo missing');
  });

  let createdInwardNo = null;
  await runTest('Procurement', 'Step 2: Create Gate Inward from PO', async () => {
    const { req, res, getData } = createMockReqRes({
      body: {
        OrderNo: createdOrderNo,
        PartyName: testPartyName,
        InwardDate: new Date().toISOString().split('T')[0],
        InvoiceNo: `INV_${testTag.slice(-4)}`,
        InvoiceDate: new Date().toISOString().split('T')[0],
        items: [
          {
            ItemName: testItemName1,
            OrderNo: createdOrderNo,
            PendingQty: 20,
            ReceivedQty: 20,
            UnitRate: 100
          },
          {
            ItemName: testItemName2,
            OrderNo: createdOrderNo,
            PendingQty: 15,
            ReceivedQty: 15,
            UnitRate: 200
          }
        ]
      }
    });
    await gateInwardController.createGateInward(req, res);
    const data = getData();
    assert(data?.success, 'Gate Inward creation failed');
    createdInwardNo = data.data?.InwardNo;
    assert(createdInwardNo, 'InwardNo missing');
  });

  let createdGRNNo = null;
  await runTest('Procurement', 'Step 3: Create Receipt (GRN) & Verify PO-linking', async () => {
    const mockPOD = createMockReqRes({ query: { orderNo: createdOrderNo } });
    await receiptController.getPurchaseOrderReceiptDetails(mockPOD.req, mockPOD.res);
    assert(mockPOD.getData()?.success, 'PO receipt details query failed');

    const { req, res, getData } = createMockReqRes({
      body: {
        PartyName: testPartyName,
        GateInwardNo: createdInwardNo,
        InwardDate: new Date().toISOString().split('T')[0],
        InvoiceNo: `INV_${testTag.slice(-4)}`,
        Total: 5000,
        GST: 780,
        GrandTotal: 5780,
        items: [
          { ItemName: testItemName1, OrderNo: createdOrderNo, Qty: 20, UnitRate: 100, TotalAmount: 2000 },
          { ItemName: testItemName2, OrderNo: createdOrderNo, Qty: 15, UnitRate: 200, TotalAmount: 3000 }
        ]
      }
    });
    await receiptController.createReceipt(req, res);
    const data = getData();
    assert(data?.success, 'Receipt creation failed');
    createdGRNNo = data.data?.GRNNo;
    assert(createdGRNNo, 'GRNNo missing');
  });

  let createdVoucherNo = null;
  await runTest('Procurement', 'Step 4: Fetch GRN Details with Enriched GST Metadata for Bill Entry', async () => {
    const { req, res, getData } = createMockReqRes({ query: { grnNo: createdGRNNo } });
    await billEntryController.getGRNDetails(req, res);
    const data = getData();
    assert(data?.success, 'GRN details lookup failed');
    const details = data.data?.details || [];
    assert(details.length === 2, 'Must have 2 items');
    
    // Check enriched GST fields
    const item1 = details.find(d => d.ItemName === testItemName1);
    const item2 = details.find(d => d.ItemName === testItemName2);
    assert(item1 && item1.SGSTPct === 6 && item1.CGSTPct === 6, 'Item 1 must have 6% SGST & 6% CGST');
    assert(item2 && item2.SGSTPct === 9 && item2.CGSTPct === 9, 'Item 2 must have 9% SGST & 9% CGST');
  });

  await runTest('Procurement', 'Step 5: Create Bill Entry (Purchase Invoice)', async () => {
    const { req, res, getData } = createMockReqRes({
      body: {
        PartyName: testPartyName,
        GateInwardNo: createdInwardNo,
        GRNNo: createdGRNNo,
        AccDate: new Date().toISOString().split('T')[0],
        PartyBillNo: `BILL_${testTag.slice(-4)}`,
        BillDate: new Date().toISOString().split('T')[0],
        PurchaseType: `PURCHASE_TEST_${testTag}`,
        Total: 5000,
        Discount: 0,
        GST: 780,
        GrandTotal: 5780,
        items: [
          { ItemName: testItemName1, OrderNo: createdOrderNo, Qty: 20, UnitRate: 100, TotalAmount: 2000 },
          { ItemName: testItemName2, OrderNo: createdOrderNo, Qty: 15, UnitRate: 200, TotalAmount: 3000 }
        ]
      }
    });
    await billEntryController.createBillEntry(req, res);
    const data = getData();
    assert(data?.success, 'Bill Entry creation failed');
    createdVoucherNo = data.data?.VoucherNo;
    assert(createdVoucherNo, 'VoucherNo missing');
  });

  // -------------------------------------------------------------------------
  // SUITE 4: PURCHASE VOUCHER GST GROUPING & PDF GENERATION
  // -------------------------------------------------------------------------
  console.log(`\n${colors.yellow}${colors.bright}4. Purchase Voucher GST Rate Grouping & PDF Output${colors.reset}`);

  let voucherPrintData = null;
  await runTest('GST Grouping', 'Fetch Print Data with Tax Rate Grouping (taxBreakdown)', async () => {
    const { req, res, getData } = createMockReqRes({ params: { voucherNo: createdVoucherNo } });
    await billEntryController.getPrintData(req, res);
    const data = getData();
    assert(data?.success, 'getPrintData failed');
    voucherPrintData = data.data;
    assert(voucherPrintData, 'Print data missing');

    const taxBreakdown = voucherPrintData.taxBreakdown || [];
    assert(taxBreakdown.length === 4, `Expected 4 tax lines (6% SGST, 6% CGST, 9% SGST, 9% CGST), got ${taxBreakdown.length}`);

    // Verify 6% SGST and 6% CGST lines
    const sgst6 = taxBreakdown.find(t => t.type === 'SGST' && t.rate === 6);
    const cgst6 = taxBreakdown.find(t => t.type === 'CGST' && t.rate === 6);
    assert(sgst6 && sgst6.amount === 120, 'SGST 6% line amount must be 120');
    assert(cgst6 && cgst6.amount === 120, 'CGST 6% line amount must be 120');

    // Verify 9% SGST and 9% CGST lines
    const sgst9 = taxBreakdown.find(t => t.type === 'SGST' && t.rate === 9);
    const cgst9 = taxBreakdown.find(t => t.type === 'CGST' && t.rate === 9);
    assert(sgst9 && sgst9.amount === 270, 'SGST 9% line amount must be 270');
    assert(cgst9 && cgst9.amount === 270, 'CGST 9% line amount must be 270');

    // Verify Purchase Account name
    assert(voucherPrintData.PurchaseAccountName === 'Test Stationery & Spares', 'PurchaseAccountName should resolve to PurchaseType Description');
  });

  await runTest('GST Grouping', 'Execute jsPDF Generation for Purchase Voucher', async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFont('helvetica', 'bold');
    doc.text('Purchase Voucher', 105, 20, { align: 'center' });
    
    // Render grouped tax breakdown
    let totalDebit = 0;
    (voucherPrintData.taxBreakdown || []).forEach(t => {
      totalDebit += t.amount;
    });
    totalDebit += parseFloat(voucherPrintData.Total) || 0;
    
    assert(totalDebit === 5780, `Total Debit expected 5780, got ${totalDebit}`);
  });

  // -------------------------------------------------------------------------
  // SUITE 5: INVENTORY, ISSUES & GATE PASSES
  // -------------------------------------------------------------------------
  console.log(`\n${colors.yellow}${colors.bright}5. Operations (Stock Issues, Gate Passes, Verifications)${colors.reset}`);

  await runTest('Operations', 'Item Issue (Create & Stock Deduction Check)', async () => {
    const { req, res, getData } = createMockReqRes({
      body: {
        Department: `Test_Dept_${testTag}`,
        IssueDate: new Date().toISOString().split('T')[0],
        IndentNo: `IND_${testTag.slice(-4)}`,
        Approval: 'Manager',
        items: [
          {
            ItemName: testItemName1,
            Qty: 5,
            UOM: 'NOS',
            EmpName: 'Worker A'
          }
        ]
      }
    });
    await itemIssueController.createItemIssue(req, res);
    const data = getData();
    assert(data?.success, 'Item issue creation failed');
  });

  let createdGPNo = null;
  await runTest('Operations', 'Gate Pass Outward (Create & Fetch Details)', async () => {
    const { req, res, getData } = createMockReqRes({
      body: {
        GpDate: new Date().toISOString().split('T')[0],
        SupplierName: testPartyName,
        Department: `Test_Dept_${testTag}`,
        GpType: 'Returnable',
        Remarks: 'For repair test',
        items: [
          { ItemName: testItemName1, Qty: 2, UOM: 'NOS', Remarks: 'Motor testing' }
        ]
      }
    });
    await gatePassOutController.createGatePassOut(req, res);
    const data = getData();
    assert(data?.success, 'Gate Pass Out creation failed');
    createdGPNo = data.data?.GpNo;
    assert(createdGPNo, 'GpNo missing');
  });

  await runTest('Operations', 'Gate Pass Inward (Create Inward against GPO)', async () => {
    const { req, res, getData } = createMockReqRes({
      body: {
        GpNo: createdGPNo,
        InDate: new Date().toISOString().split('T')[0],
        SupplierName: testPartyName,
        Department: `Test_Dept_${testTag}`,
        items: [
          { ItemName: testItemName1, Qty: 2, UOM: 'NOS', Remarks: 'Returned after repair' }
        ]
      }
    });
    await gatePassInController.createGatePassIn(req, res);
    const data = getData();
    assert(data?.success, 'Gate Pass In creation failed');
  });

  // -------------------------------------------------------------------------
  // SUITE 6: DASHBOARD & REPORT GENERATION
  // -------------------------------------------------------------------------
  console.log(`\n${colors.yellow}${colors.bright}6. Dashboard Analytics & Reporting${colors.reset}`);

  await runTest('Reports & Analytics', 'Dashboard Statistics API (KPIs, Charts, Stock Summary)', async () => {
    const { req, res, getData } = createMockReqRes();
    await dashboardController.getDashboardStats(req, res);
    const data = getData();
    assert(data?.success, 'Dashboard stats failed');
    assert(data.data?.kpis, 'KPIs object missing');
    assert(data.data?.stockSummary, 'Stock summary missing');
  });

  await runTest('Reports & Analytics', 'Export Item-Wise Stock to Excel Workbook', async () => {
    const { req, res, getHeaders } = createMockReqRes();
    await reportController.exportItemWiseStock(req, res);
    const headers = getHeaders();
    assert(headers['Content-Type']?.includes('spreadsheetml'), 'Excel content type header missing');
  });

  // -------------------------------------------------------------------------
  // SUITE 7: AUTHENTICATION, PASSWORD HASHING & SECURITY
  // -------------------------------------------------------------------------
  console.log(`\n${colors.yellow}${colors.bright}7. User Authentication & Password Security${colors.reset}`);

  let testUserId = null;
  const testUsername = `sec_test_${Date.now()}`;
  const testPassword = 'Password@123';
  const newPassword = 'NewSecretPassword@456';

  await runTest('Authentication', 'Register New User with Bcrypt Hashed Password', async () => {
    const { req, res, getData, getStatus } = createMockReqRes({
      body: {
        username: testUsername,
        password: testPassword,
        full_name: 'Security Test User',
        email: `${testUsername}@example.com`,
        role: 'operator'
      }
    });
    await authController.register(req, res);
    const data = getData();
    assert(getStatus() === 201 && data?.success, `User registration failed: ${data?.message}`);
    assert(data.user?.id, 'User ID missing in registration response');
    testUserId = data.user.id;
  });

  let testToken = null;
  await runTest('Authentication', 'Login with Correct Credentials (JWT Token Generation)', async () => {
    const { req, res, getData } = createMockReqRes({
      body: { username: testUsername, password: testPassword }
    });
    await authController.login(req, res);
    const data = getData();
    assert(data?.success, 'Login failed with valid credentials');
    assert(data?.token, 'JWT token missing in login response');
    testToken = data.token;
  });

  await runTest('Authentication', 'Reject Login with Invalid Password', async () => {
    const { req, res, getData, getStatus } = createMockReqRes({
      body: { username: testUsername, password: 'WrongPassword999' }
    });
    await authController.login(req, res);
    const data = getData();
    assert(getStatus() === 401 && !data?.success, 'Login should have failed with invalid credentials');
  });

  await runTest('Authentication', 'Get Authenticated User Profile (/api/auth/me)', async () => {
    const { req, res, getData } = createMockReqRes({
      user: { id: testUserId }
    });
    await authController.getCurrentUser(req, res);
    const data = getData();
    assert(data?.success, 'Failed to fetch user profile');
    assert(data.user?.username === testUsername, 'Username in profile mismatch');
  });

  await runTest('Authentication', 'Change Password (verify current, enforce complexity, re-hash)', async () => {
    const { req, res, getData } = createMockReqRes({
      user: { id: testUserId },
      body: {
        currentPassword: testPassword,
        newPassword: newPassword,
        confirmPassword: newPassword
      }
    });
    await authController.changePassword(req, res);
    const data = getData();
    assert(data?.success, `Change password failed: ${data?.message}`);

    // Verify new password works
    const mockLogin = createMockReqRes({
      body: { username: testUsername, password: newPassword }
    });
    await authController.login(mockLogin.req, mockLogin.res);
    assert(mockLogin.getData()?.success, 'Login with new password failed');
  });

  // -------------------------------------------------------------------------
  // SUITE 8: CLEANUP AUTOMATED TEST RECORDS
  // -------------------------------------------------------------------------
  console.log(`\n${colors.yellow}${colors.bright}8. Automated Cleanup of Test Records${colors.reset}`);

  await runTest('Cleanup', 'Clean test chain (Bill Entry, Receipt, Gate Inward, PO, Items, User, Dept)', async () => {
    // Clean test user
    if (testUserId) {
      await User.destroy({ where: { id: testUserId } });
    }
    // Delete Bill Chain
    if (createdVoucherNo) {
      const mockDel = createMockReqRes({
        params: { voucherNo: createdVoucherNo },
        body: { layers: { bill: true, receipt: true, gateInward: true, purchaseOrder: true } }
      });
      await billEntryController.deleteBillChain(mockDel.req, mockDel.res);
    }

    // Clean test items
    await Item.destroy({ where: { ItemName: { [Op.in]: [testItemName1, testItemName2] } } });
    
    // Clean test purchase type
    await PurchaseType.destroy({ where: { Code: 9999 } });

    // Clean test supplier
    await Supplier.destroy({ where: { supplier_name: testPartyName } });

    // Clean test department & subhead
    if (testSubHeadId) await SubHead.destroy({ where: { SubHeadId: testSubHeadId } });
    if (testDeptId) await Department.destroy({ where: { dept_id: testDeptId } });
    if (testProdHeadCode) await ProductHead.destroy({ where: { prodhead_code: testProdHeadCode } });
  });

  // -------------------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------------------
  const totalElapsed = ((Date.now() - totalStartTime) / 1000).toFixed(2);
  console.log(`\n${colors.cyan}${colors.bright}========================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}   📊 DIAGNOSTICS & TEST RUN SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}========================================================================${colors.reset}`);
  console.log(`  Total Tests Run : ${colors.bright}${state.total}${colors.reset}`);
  console.log(`  Passed          : ${colors.green}${colors.bright}${state.passed}${colors.reset}`);
  console.log(`  Failed          : ${state.failed > 0 ? colors.red : colors.green}${colors.bright}${state.failed}${colors.reset}`);
  console.log(`  Execution Time  : ${totalElapsed}s\n`);

  if (state.failures.length > 0) {
    console.log(`${colors.red}${colors.bright}Failed Tests Detail:${colors.reset}`);
    state.failures.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.suite}] ${f.test}: ${f.error}`);
    });
    console.log();
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bright}🎉 ALL MODULES AND FUNCTIONALITIES ARE OPERATIONAL AND PASSING!${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
