const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'helpdesk_db',
};

const columnsToAdd = [
  { name: 'revision_notes', type: 'TEXT' },
  { name: 'published_at', type: 'DATETIME' },
  { name: 'unpublished_at', type: 'DATETIME' },
  { name: 'archived_at', type: 'DATETIME' },
  { name: 'deleted_at', type: 'DATETIME' },
];

async function fixSchema() {
  const connection = await mysql.createConnection(config);
  try {
    const [rows] = await connection.query('SHOW COLUMNS FROM knowledge_base');
    const existingColumns = rows.map(r => r.Field);

    for (const col of columnsToAdd) {
      if (!existingColumns.includes(col.name)) {
        console.log(`Adding column: ${col.name}`);
        await connection.query(`ALTER TABLE knowledge_base ADD COLUMN ${col.name} ${col.type} NULL`);
      } else {
        console.log(`Column already exists: ${col.name}`);
      }
    }
    console.log('Schema fix complete.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await connection.end();
  }
}

fixSchema();
