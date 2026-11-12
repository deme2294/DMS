async function test() {
  const jwt = (await import('jsonwebtoken')).default;
  const jwtConfig = (await import('./config/jwt.js')).default;

  console.log('1. Testing without token:');
  const res1 = await fetch('http://localhost:5000/api/tickets/notifications?limit=100');
  console.log('Status 1:', res1.status);
  const data1 = await res1.json();
  console.log('Body 1:', data1);

  console.log('\n2. Testing with legacy UUID token (sub: 11111111-1111-1111-1111-111111111111, username: admin):');
  const legacyPayload = { sub: '11111111-1111-1111-1111-111111111111', role: 'admin', username: 'admin' };
  const legacyToken = jwt.sign(legacyPayload, jwtConfig.accessSecret, { expiresIn: '1h' });
  const res2 = await fetch('http://localhost:5000/api/tickets/notifications?limit=100', {
    headers: { Authorization: `Bearer ${legacyToken}` }
  });
  console.log('Status 2:', res2.status);
  const data2 = await res2.json();
  console.log('Body 2:', data2);

  console.log('\n3. Testing with 4-digit token (sub: 1001, username: admin):');
  const currentPayload = { sub: '1001', role: 'admin', username: 'admin' };
  const currentToken = jwt.sign(currentPayload, jwtConfig.accessSecret, { expiresIn: '1h' });
  const res3 = await fetch('http://localhost:5000/api/tickets/notifications?limit=100', {
    headers: { Authorization: `Bearer ${currentToken}` }
  });
  console.log('Status 3:', res3.status);
  const data3 = await res3.json();
  console.log('Body 3:', data3);

  console.log('\n4. Testing unread count with 4-digit token:');
  const res4 = await fetch('http://localhost:5000/api/tickets/notifications/unread-count', {
    headers: { Authorization: `Bearer ${currentToken}` }
  });
  console.log('Status 4:', res4.status);
  const data4 = await res4.json();
  console.log('Body 4:', data4);

  process.exit(0);
}

test().catch(console.error);

