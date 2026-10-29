const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const databaseUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_OnIYyu3qWMZ8@ep-bitter-dream-b32qqe74-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function executeSqlFile(sql, filePath) {
  console.log(`Executing ${path.basename(filePath)}...`);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Remove full line comments and split by semicolon (careful with strings)
  // Or run statement by statement
  const statements = content
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    if (!statement || statement.startsWith('--')) continue;
    try {
      await sql.query(statement);
    } catch (err) {
      // Ignore if function / table already exists or minor notice
      if (err.message && (err.message.includes('already exists') || err.message.includes('duplicate key'))) {
        // ok
      } else {
        console.warn(`Warning on statement: ${statement.slice(0, 60)}...`);
        console.warn(`Reason: ${err.message}`);
      }
    }
  }
}

async function main() {
  const sql = neon(databaseUrl);
  console.log('--- Initializing Neon DB Schema ---');

  // 1. Combined setup (master & transaksi & user)
  const combinedPath = path.join(__dirname, '..', '_refs', 'combined_setup.sql');
  if (fs.existsSync(combinedPath)) {
    await executeSqlFile(sql, combinedPath);
  }

  // 2. Sparepart table
  const sparepartPath = path.join(__dirname, '..', '_refs', 'migration_sparepart.sql');
  if (fs.existsSync(sparepartPath)) {
    await executeSqlFile(sql, sparepartPath);
  }

  // 3. Kategori & Barang (Kelontong & Baju)
  const kategoriPath = path.join(__dirname, '..', '_refs', 'add_kategori_table.sql');
  if (fs.existsSync(kategoriPath)) {
    await executeSqlFile(sql, kategoriPath);
  }

  // Check tables created
  const tables = await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('--- Migration Finished! ---');
  console.log(`Total tables in Neon DB: ${tables.length}`);
  console.log(tables.map(t => t.table_name).join(', '));
}

main().catch(console.error);
