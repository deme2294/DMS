// Cleanup script: Remove tickets notifications sent to staff users who aren't the assignee
import mysql from 'mysql2/promise';

const pool = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'helpdesk_db' });

try {
    const [result] = await pool.query(
        `DELETE n FROM notifications n
         JOIN users u ON u.id = n.user_id
         JOIN roles r ON r.id = u.role_id
         JOIN tickets t ON t.id = n.ticket_id
         WHERE r.name = 'staff'
           AND n.ticket_id IS NOT NULL
           AND (t.assigned_to IS NULL OR t.assigned_to != u.id)`
    );
    console.log(`Deleted ${result.affectedRows} incorrect staff ticket notifications`);
} catch (e) {
    console.error('Cleanup failed:', e.message);
} finally {
    await pool.end();
    process.exit(0);
}

