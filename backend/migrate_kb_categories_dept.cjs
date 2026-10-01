const pool = require('./config/db.js').default;

async function run() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM knowledge_categories LIKE 'department_id'");
    if (!cols.length) {
      await pool.query("ALTER TABLE knowledge_categories ADD COLUMN department_id CHAR(36) NULL AFTER parent_id, ADD KEY idx_kb_category_dept (department_id)");
      console.log('Successfully added department_id to knowledge_categories');
    } else {
      console.log('department_id column already exists');
    }

    // Relax unique index on name and slug so different departments can have categories with the same name
    const [indexes] = await pool.query("SHOW INDEX FROM knowledge_categories");
    const indexNames = new Set(indexes.map(i => i.Key_name));
    if (indexNames.has('name')) {
      await pool.query("ALTER TABLE knowledge_categories DROP INDEX name, ADD KEY idx_kb_category_name (name)");
      console.log('Updated name index to non-unique');
    }
    if (indexNames.has('slug')) {
      await pool.query("ALTER TABLE knowledge_categories DROP INDEX slug, ADD KEY idx_kb_category_slug (slug)");
      console.log('Updated slug index to non-unique');
    }

    console.log('Migration complete');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
