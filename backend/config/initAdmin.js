const bcrypt = require('bcryptjs');
const { User } = require('../models/index');

const initAdmin = async () => {
  try {
    const userCount = await User.count();
    if (userCount === 0) {
      console.log('⚡ No users found in database. Initializing default admin user...');
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('admin123', salt);

      await User.create({
        username: 'admin',
        password: hashedPassword,
        full_name: 'System Administrator',
        email: 'admin@stores.local',
        role: 'admin',
        status: 'active'
      });
      console.log('✓ Default admin account created: [username: admin]');
    }
  } catch (error) {
    console.error('Error initializing admin user:', error.message);
  }
};

module.exports = initAdmin;
