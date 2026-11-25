const db = require('../config/db.js').default || require('../config/db.js');

async function check() {
  const pool = db;
  const [tables] = await pool.query("SHOW TABLES LIKE 'ticket_merges'");
  console.log('ticket_merges exists:', tables.length > 0);
  
  const [cols] = await pool.query("DESCRIBE tickets");
  const mergeCols = cols.filter(c => c.Field.includes('merge'));
  console.log('Merge columns in tickets:', mergeCols.map(c => c.Field));
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
