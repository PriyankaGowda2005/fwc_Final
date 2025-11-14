// Direct test of login endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

const testLogin = async (email, password, isCandidate = false) => {
  try {
    const endpoint = isCandidate ? '/candidates/login' : '/auth/login';
    const response = await axios.post(`${BASE_URL}${endpoint}`, {
      email,
      password
    });
    
    console.log(`✅ ${isCandidate ? 'CANDIDATE' : 'USER'} Login Success: ${email}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log(`❌ ${isCandidate ? 'CANDIDATE' : 'USER'} Login Failed: ${email}`);
    console.log(`   Error:`, error.response?.data || error.message);
    return false;
  }
};

const main = async () => {
  console.log('🧪 Testing Login Endpoints Directly...\n');
  console.log('⚠️  Make sure backend server is running on port 3001!\n');
  
  // Test all logins
  await testLogin('admin@FWCinfotech.com', 'admin123');
  await testLogin('hr@FWCinfotech.com', 'HR@2024!');
  await testLogin('manager@FWCinfotech.com', 'manager123');
  await testLogin('employee@FWCinfotech.com', 'employee123');
  await testLogin('candidate.demo@FWCinfotech.com', 'candidate123', true);
  
  console.log('\n✅ All login tests completed!');
};

main().catch(console.error);

