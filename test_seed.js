#!/usr/bin/env node
import fetch from 'node-fetch';

const testSeed = async () => {
  try {
    const seedResp = await fetch('https://moliam-staging.pages.dev/api/admin/seed', {
      method: 'POST',
      headers: { 'X-Seed-Key': 'moliam2026' }
    });
    
    const seedText = await seedResp.text();
    console.log('SEED response:', seedText);

    if (seedResp.ok) {
      const loginResp = await fetch('https://moliam-staging.pages.dev/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@moliam.com', password: 'Moliam2026!' })
      });
      
      const loginText = await loginResp.text();
      console.log('LOGIN response:', loginText);
    }
  } catch (err) {
    console.error('Test failed:', err.message);
  }
};

testSeed();
