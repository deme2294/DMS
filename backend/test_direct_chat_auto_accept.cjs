const pool = require('./config/db.js').default || require('./config/db.js');
const { canContact } = require('./config/contactMatrix.js');
const chatService = require('./services/chatService.js');
const userRepo = require('./repository/userRepository.js');

async function runTest() {
  console.log('--- Starting Direct Chat Auto-Accept & Video Conference Tests ---');

  // 1. Verify Contact Permissions
  console.log('1. Testing contact matrix permissions:');
  const roles = ['admin', 'manager', 'staff', 'tenant', 'ceo'];
  for (const role of roles) {
    const allowed = canContact('admin', role);
    console.log(`canContact('admin', '${role}'): ${allowed}`);
    if (!allowed) {
      throw new Error(`Admin should be permitted to directly contact ${role}`);
    }
  }
  console.log('PASS: Admin has full contact permission to all registered roles.');

  // 2. Fetch test users
  const [users] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, r.name as role 
     FROM users u 
     JOIN roles r ON r.id = u.role_id 
     WHERE u.status = 'active'`
  );

  const adminUser = users.find(u => u.role === 'admin');
  const managerUser = users.find(u => u.role === 'manager');
  const staffUser = users.find(u => u.role === 'staff');

  if (!adminUser || !managerUser) {
    throw new Error('Could not find admin and manager test users');
  }

  console.log(`Admin User: ${adminUser.first_name} (${adminUser.id})`);
  console.log(`Manager User: ${managerUser.first_name} (${managerUser.id})`);

  // 3. Test createDirectRoom in 'chat' mode
  console.log('\n2. Testing createDirectRoom in "chat" mode:');
  const chatRoom = await chatService.createDirectRoom(adminUser.id, managerUser.id, 'admin', 'chat');
  console.log(`Direct Room ID: ${chatRoom.id}`);
  console.log(`Direct Room Name: ${chatRoom.name}`);
  console.log(`Other user first name: ${chatRoom.other_user_first_name}, role: ${chatRoom.other_user_role}`);

  // Verify participants in DB
  const [participants] = await pool.query(
    `SELECT * FROM chat_participants WHERE room_id = ?`,
    [chatRoom.id]
  );
  console.log(`Participants count: ${participants.length}`);
  for (const p of participants) {
    console.log(`Participant ${p.user_id}: is_active = ${p.is_active}`);
    if (!p.is_active) {
      throw new Error(`Participant ${p.user_id} was not auto-accepted as active!`);
    }
  }
  console.log('PASS: Both registered participants are auto-accepted and active.');

  // 4. Test createDirectRoom in 'video' mode
  console.log('\n3. Testing createDirectRoom in "video" mode:');
  const videoRoom = await chatService.createDirectRoom(adminUser.id, managerUser.id, 'admin', 'video');
  
  // Verify meeting invite message was posted
  const [messages] = await pool.query(
    `SELECT * FROM chat_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 1`,
    [videoRoom.id]
  );
  console.log(`Latest message in room: ${messages[0]?.message.substring(0, 40)}...`);
  if (!messages[0]?.message.includes('[VIDEO_CONFERENCE]')) {
    throw new Error('Video conference call message was not auto-generated!');
  }
  console.log('PASS: Direct video conference call automatically initiated and message posted.');

  // 5. Test auto-reactivation when participant was inactive
  console.log('\n4. Testing auto-reactivation of inactive participant:');
  await pool.query(
    `UPDATE chat_participants SET is_active = FALSE WHERE room_id = ? AND user_id = ?`,
    [chatRoom.id, managerUser.id]
  );
  const reactivatedRoom = await chatService.createDirectRoom(adminUser.id, managerUser.id, 'admin', 'chat');
  const [reactivatedParticipants] = await pool.query(
    `SELECT * FROM chat_participants WHERE room_id = ? AND user_id = ?`,
    [chatRoom.id, managerUser.id]
  );
  console.log(`Reactivated participant is_active: ${reactivatedParticipants[0].is_active}`);
  if (!reactivatedParticipants[0].is_active) {
    throw new Error('Participant was not auto-reactivated!');
  }
  console.log('PASS: Inactive participant was automatically accepted & reactivated.');

  console.log('\n--- ALL DIRECT CHAT AUTO-ACCEPT TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

runTest().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
