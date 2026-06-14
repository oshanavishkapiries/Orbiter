import axios from 'axios';
import { config } from '../src/config/index.js';

const PORT = process.env.PORT || '4040';
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

async function testSave() {
  console.log('Testing Settings Save...');
  
  // 1. Login to get token
  console.log('Attempting login...');
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    username: 'admin',
    password: 'admin'
  });
  
  const token = loginRes.data.token;
  console.log('Login successful! Token acquired.');

  const headers = {
    Authorization: `Bearer ${token}`
  };

  // 2. Fetch current settings
  console.log('Fetching initial settings...');
  const getRes = await axios.get(`${BASE_URL}/system/settings`, { headers });
  console.log('Initial settings keys in DB:', getRes.data.settings.map((s: any) => s.key));

  // 3. Update settings (put openrouterApiKey)
  console.log('Updating settings...');
  const testApiKey = 'sk-or-test-key-12345';
  
  const payload = [
    { key: 'llm.provider', value: 'openrouter' },
    { key: 'llm.openrouterApiKey', value: testApiKey },
    { key: 'llm.opencodeApiKey', value: 'sk-oc-test-key-abcde' },
    { key: 'llm.model', value: 'anthropic/claude-sonnet-4' }
  ];

  const putRes = await axios.put(`${BASE_URL}/system/settings`, { settings: payload }, { headers });
  console.log('Update settings response:', putRes.data);

  // 4. Fetch settings again to verify
  console.log('Refetching settings...');
  const getVerifyRes = await axios.get(`${BASE_URL}/system/settings`, { headers });
  const openrouterKeySetting = getVerifyRes.data.settings.find((s: any) => s.key === 'llm.openrouterApiKey');
  console.log('Verifying OpenRouter Key in response:', openrouterKeySetting);

  if (openrouterKeySetting && openrouterKeySetting.value === testApiKey) {
    console.log('✅ Success! Settings saved and retrieved successfully.');
  } else {
    console.error('❌ Fail! Saved key does not match or is missing.');
  }
}

testSave().catch(err => {
  console.error('Test failed with error:', err.response?.data || err.message);
});
