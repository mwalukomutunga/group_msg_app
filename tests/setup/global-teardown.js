const { globalTeardown } = require('./database');

/**
 * Jest global teardown - runs once after all tests
 */
module.exports = async () => {
  console.log('🏁 Jest Global Teardown Starting...');
  
  try {
    await globalTeardown();
    console.log('✅ Jest Global Teardown Completed Successfully');
  } catch (error) {
    console.error('❌ Jest Global Teardown Failed:', error.message);
  }
};
