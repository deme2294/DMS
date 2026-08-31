const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({host:'localhost',user:'root',database:'helpdesk_db'});
  try {
    await conn.query("ALTER TABLE assignments ADD COLUMN role ENUM('department_manager','staff') NOT NULL DEFAULT 'staff'");
    console.log('Added role');
  } catch (e) { console.log('role error:', e.message); }
  try {
    await conn.query("ALTER TABLE assignments ADD COLUMN from_assignment_id CHAR(36) NULL");
    console.log('Added from_assignment_id');
  } catch (e) { console.log('from_assignment_id error:', e.message); }
  try {
    await conn.query("ALTER TABLE assignments ADD COLUMN accepted_at DATETIME NULL");
    console.log('Added accepted_at');
  } catch (e) { console.log('accepted_at error:', e.message); }
  try {
    await conn.query("ALTER TABLE assignments ADD COLUMN rejected_at DATETIME NULL");
    console.log('Added rejected_at');
  } catch (e) { console.log('rejected_at error:', e.message); }
  try {
    await conn.query("ALTER TABLE assignments ADD COLUMN reassigned_at DATETIME NULL");
    console.log('Added reassigned_at');
  } catch (e) { console.log('reassigned_at error:', e.message); }
  
  try {
    await conn.query("ALTER TABLE assignments ADD COLUMN priority VARCHAR(20) NULL");
    console.log('Added priority');
  } catch (e) { console.log('priority error:', e.message); }

  try {
    await conn.query("ALTER TABLE assignments ADD COLUMN category VARCHAR(100) NULL");
    console.log('Added category');
  } catch (e) { console.log('category error:', e.message); }
  await conn.end();
})().catch(e => console.error(e));
