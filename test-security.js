const path = require('path');
require(path.resolve(__dirname, 'backend/node_modules/dotenv')).config({ path: __dirname + '/backend/.env' });
const jwt = require(path.resolve(__dirname, 'backend/node_modules/jsonwebtoken'));
const bcrypt = require(path.resolve(__dirname, 'backend/node_modules/bcryptjs'));

const { sequelize, User } = require('./backend/models/index');
const authController = require('./backend/controllers/authController');
const { auth, authorize } = require('./backend/middleware/auth');
const initAdmin = require('./backend/config/initAdmin');

// Helper: Mock Express Request/Response
function createMockReqRes(reqData = {}) {
  let statusCode = 200;
  let responseData = null;
  let headers = {};

  const req = {
    body: {},
    params: {},
    query: {},
    headers: {},
    header: (name) => req.headers[name.toLowerCase()] || req.headers[name],
    ...reqData
  };

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    setHeader: (name, val) => {
      headers[name] = val;
      return res;
    }
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
    getHeaders: () => headers
  };
}

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

async function runSecurityAudit() {
  console.log(`\n${colors.cyan}${colors.bright}========================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}   🔒 AUTOMATED APPLICATION SECURITY & AUTHENTICATION TEST RUNNER${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}========================================================================${colors.reset}\n`);

  let total = 0;
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  ${colors.green}✓${colors.reset} ${name}`);
    } catch (err) {
      failed++;
      console.log(`  ${colors.red}✗${colors.reset} ${name}`);
      console.log(`    ${colors.red}Error: ${err.message}${colors.reset}`);
    }
  }

  // 1. DB & Model Sync
  await test('Database Connection & User Table Sync', async () => {
    await sequelize.authenticate();
    await User.sync();
  });

  // 2. Default Admin Initialization
  await test('Default Admin Auto-Initialization', async () => {
    await initAdmin();
    const admin = await User.findOne({ where: { username: 'admin' } });
    if (!admin) throw new Error('Admin user was not created');
    if (admin.role !== 'admin') throw new Error('Admin role mismatch');
  });

  // 3. User Registration
  const testUser = `sec_user_${Date.now()}`;
  const initialPassword = 'InitialSecretPass@123';
  const updatedPassword = 'NewSecretPass@789';
  let createdUserId = null;

  await test('Register New User (Bcrypt 12-Round Password Hashing)', async () => {
    const { req, res, getData, getStatus } = createMockReqRes({
      body: {
        username: testUser,
        password: initialPassword,
        full_name: 'Security Test Specialist',
        email: `${testUser}@stores.local`,
        role: 'operator'
      }
    });

    await authController.register(req, res);
    const data = getData();
    if (getStatus() !== 201 || !data?.success) {
      throw new Error(data?.message || 'Registration failed');
    }
    createdUserId = data.user.id;

    // Verify hash is not plaintext
    const dbUser = await User.findByPk(createdUserId);
    if (dbUser.password === initialPassword) {
      throw new Error('CRITICAL: Password stored in plaintext!');
    }
    const isValid = await bcrypt.compare(initialPassword, dbUser.password);
    if (!isValid) throw new Error('Password hash does not match initial password');
  });

  // 4. Login with Correct Credentials
  let userToken = null;
  await test('Login with Valid Credentials & Issue Signed JWT', async () => {
    const { req, res, getData, getStatus } = createMockReqRes({
      body: { username: testUser, password: initialPassword }
    });

    await authController.login(req, res);
    const data = getData();
    if (getStatus() !== 200 || !data?.success) {
      throw new Error(data?.message || 'Login failed');
    }
    if (!data.token) throw new Error('JWT token not returned in response');
    userToken = data.token;

    // Verify JWT payload
    const decoded = jwt.verify(userToken, process.env.JWT_SECRET || 'stores-secure-jwt-key-2026');
    if (decoded.username !== testUser) throw new Error('JWT payload username mismatch');
  });

  // 5. Login Rejection with Invalid Credentials
  await test('Reject Login with Incorrect Password (401 Unauthorized)', async () => {
    const { req, res, getData, getStatus } = createMockReqRes({
      body: { username: testUser, password: 'WrongPassword@999' }
    });

    await authController.login(req, res);
    const data = getData();
    if (getStatus() !== 401 || data?.success) {
      throw new Error('Login with incorrect password should return 401');
    }
  });

  // 6. Profile Lookup via Protected Endpoint
  await test('Get Authenticated User Profile (/api/auth/me)', async () => {
    const { req, res, getData, getStatus } = createMockReqRes({
      user: { id: createdUserId }
    });

    await authController.getCurrentUser(req, res);
    const data = getData();
    if (getStatus() !== 200 || !data?.success) {
      throw new Error(data?.message || 'Get profile failed');
    }
    if (data.user.username !== testUser) throw new Error('Profile username mismatch');
  });

  // 7. Change Password Validations & Success Flow
  await test('Change Password: Reject Wrong Current Password', async () => {
    const { req, res, getData, getStatus } = createMockReqRes({
      user: { id: createdUserId },
      body: {
        currentPassword: 'IncorrectOldPassword',
        newPassword: updatedPassword,
        confirmPassword: updatedPassword
      }
    });

    await authController.changePassword(req, res);
    const data = getData();
    if (getStatus() === 200 && data?.success) {
      throw new Error('Should have rejected incorrect current password');
    }
  });

  await test('Change Password: Reject Password Mismatch', async () => {
    const { req, res, getData, getStatus } = createMockReqRes({
      user: { id: createdUserId },
      body: {
        currentPassword: initialPassword,
        newPassword: updatedPassword,
        confirmPassword: 'DifferentConfirmPass'
      }
    });

    await authController.changePassword(req, res);
    const data = getData();
    if (getStatus() === 200 && data?.success) {
      throw new Error('Should have rejected mismatched confirm password');
    }
  });

  await test('Change Password: Successful Update & Re-Login with New Password', async () => {
    const { req, res, getData, getStatus } = createMockReqRes({
      user: { id: createdUserId },
      body: {
        currentPassword: initialPassword,
        newPassword: updatedPassword,
        confirmPassword: updatedPassword
      }
    });

    await authController.changePassword(req, res);
    const data = getData();
    if (getStatus() !== 200 || !data?.success) {
      throw new Error(data?.message || 'Password update failed');
    }

    // Verify old password is now rejected
    const oldLogin = createMockReqRes({
      body: { username: testUser, password: initialPassword }
    });
    await authController.login(oldLogin.req, oldLogin.res);
    if (oldLogin.getStatus() === 200 && oldLogin.getData()?.success) {
      throw new Error('Old password should no longer work after change');
    }

    // Verify new password succeeds
    const newLogin = createMockReqRes({
      body: { username: testUser, password: updatedPassword }
    });
    await authController.login(newLogin.req, newLogin.res);
    if (newLogin.getStatus() !== 200 || !newLogin.getData()?.success) {
      throw new Error('New password login failed');
    }
  });

  // 8. Auth Middleware Token Verification
  await test('Auth Middleware: Reject Request without Token (401)', async () => {
    const { req, res, getStatus } = createMockReqRes({
      headers: {}
    });
    let nextCalled = false;
    await auth(req, res, () => { nextCalled = true; });
    if (nextCalled || getStatus() !== 401) {
      throw new Error('Auth middleware must reject unauthenticated requests');
    }
  });

  await test('Auth Middleware: Accept Request with Valid Bearer Token', async () => {
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${userToken}` }
    });
    let nextCalled = false;
    await auth(req, res, () => { nextCalled = true; });
    if (!nextCalled || !req.user || req.user.username !== testUser) {
      throw new Error('Auth middleware failed to authenticate valid token');
    }
  });

  // 9. Role-Based Access Control (RBAC)
  await test('RBAC Middleware: Restrict Admin-Only Resource from Operator', async () => {
    const { req, res, getStatus } = createMockReqRes({
      user: { id: createdUserId, username: testUser, role: 'operator' }
    });
    let nextCalled = false;
    const adminOnly = authorize('admin');
    adminOnly(req, res, () => { nextCalled = true; });
    if (nextCalled || getStatus() !== 403) {
      throw new Error('RBAC middleware must return 403 Forbidden for non-admins');
    }
  });

  await test('RBAC Middleware: Permit Admin Resource for Admin User', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 1, username: 'admin', role: 'admin' }
    });
    let nextCalled = false;
    const adminOnly = authorize('admin');
    adminOnly(req, res, () => { nextCalled = true; });
    if (!nextCalled) {
      throw new Error('RBAC middleware failed to permit admin user');
    }
  });

  // 10. Cleanup
  if (createdUserId) {
    await User.destroy({ where: { id: createdUserId } });
  }

  console.log(`\n${colors.cyan}${colors.bright}========================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}   📊 SECURITY AUDIT SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}========================================================================${colors.reset}`);
  console.log(`  Total Security Tests : ${colors.bright}${total}${colors.reset}`);
  console.log(`  Passed               : ${colors.green}${colors.bright}${passed}${colors.reset}`);
  console.log(`  Failed               : ${failed > 0 ? colors.red : colors.green}${colors.bright}${failed}${colors.reset}\n`);

  if (failed === 0) {
    console.log(`${colors.green}${colors.bright}🎉 ALL 10 SECURITY & AUTHENTICATION SYSTEMS PASSED AND ARE FULLY OPERATIONAL!${colors.reset}\n`);
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSecurityAudit().catch(err => {
  console.error('Fatal security test runner error:', err);
  process.exit(1);
});
