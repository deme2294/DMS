import pool from './config/db.js';

async function migrate() {
  try {
    // 1. Alter type column to VARCHAR(50) so it supports any module
    await pool.query("ALTER TABLE notifications MODIFY COLUMN type VARCHAR(50) DEFAULT 'ticket'");
    console.log('Altered type column to VARCHAR(50)');

    // 2. Add article_id column if not exists
    const [cols] = await pool.query("SHOW COLUMNS FROM notifications LIKE 'article_id'");
    if (cols.length === 0) {
      await pool.query("ALTER TABLE notifications ADD COLUMN article_id CHAR(36) NULL AFTER room_id, ADD INDEX idx_notif_article (article_id)");
      console.log('Added article_id column to notifications');
    } else {
      console.log('article_id already exists');
    }

    // 3. Update existing knowledge notifications
    const [updated] = await pool.query(
      "UPDATE notifications SET type = 'knowledge' WHERE (title LIKE '%Article%' OR message LIKE '%(KB-%' OR message LIKE '%article%') AND (type = '' OR type = 'ticket')"
    );
    console.log('Updated existing notifications to type knowledge:', updated.affectedRows);

    // 4. Try linking article_id for existing notifications using reference code in message
    const [notifs] = await pool.query(
      "SELECT id, message FROM notifications WHERE type = 'knowledge' AND article_id IS NULL"
    );
    console.log('Found knowledge notifs without article_id:', notifs.length);

    for (const n of notifs) {
      const match = n.message?.match(/KB-\d{4}-\d{6}/i);
      if (match) {
        const ref = match[0];
        const [kb] = await pool.query('SELECT id FROM knowledge_base WHERE article_reference = ? LIMIT 1', [ref]);
        if (kb.length > 0) {
          await pool.query('UPDATE notifications SET article_id = ? WHERE id = ?', [kb[0].id, n.id]);
          console.log('Linked notif', n.id, 'to article', kb[0].id, ref);
        }
      }
    }
  } catch (err) {
    console.error('Error migrating notifications:', err);
  } finally {
    process.exit();
  }
}

migrate();
