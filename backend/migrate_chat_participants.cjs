const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({host:'localhost',user:'root',database:'helpdesk_db'});
  try {
    // Backfill ticket rooms: add creator as participant if missing
    const [ticketRooms] = await conn.query(`
      SELECT cr.id AS room_id, cr.created_by AS user_id
      FROM chat_rooms cr
      LEFT JOIN chat_participants cp ON cp.room_id = cr.id AND cp.user_id = cr.created_by
      WHERE cr.room_type = 'ticket' AND cp.id IS NULL
    `);
    console.log(`Found ${ticketRooms.length} ticket rooms missing creator as participant`);
    for (const room of ticketRooms) {
      await conn.query(
        `INSERT IGNORE INTO chat_participants (id, room_id, user_id, joined_at, is_active) VALUES (UUID(), ?, ?, NOW(), 1)`,
        [room.room_id, room.user_id]
      );
      console.log(`  Added creator ${room.user_id} to room ${room.room_id}`);
    }

    // Backfill department rooms: add creator as participant if missing
    const [deptRooms] = await conn.query(`
      SELECT cr.id AS room_id, cr.created_by AS user_id
      FROM chat_rooms cr
      LEFT JOIN chat_participants cp ON cp.room_id = cr.id AND cp.user_id = cr.created_by
      WHERE cr.room_type = 'department' AND cp.id IS NULL
    `);
    console.log(`Found ${deptRooms.length} department rooms missing creator as participant`);
    for (const room of deptRooms) {
      await conn.query(
        `INSERT IGNORE INTO chat_participants (id, room_id, user_id, joined_at, is_active) VALUES (UUID(), ?, ?, NOW(), 1)`,
        [room.room_id, room.user_id]
      );
      console.log(`  Added creator ${room.user_id} to room ${room.room_id}`);
    }

    console.log('Backfill complete');
  } catch (e) {
    console.error(e);
  }
  await conn.end();
})();
