require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const tables = ['entity','student','lecturer','class','enrollment','schedule','session','attendance','assignment','biometric','excuse_request'];

async function run() {
  for (const t of tables) {
    try {
      const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position`, [t]);
      if (r.rows.length) {
        console.log(`\n${t}:`);
        r.rows.forEach(row => console.log(`  ${row.column_name} (${row.data_type})`));
      }
    } catch(e) {}
  }

  // Sample data
  console.log('\n--- SAMPLE DATA ---');
  const samples = ['entity','student','enrollment','attendance','session','schedule','assignment'];
  for (const t of samples) {
    try {
      const r = await pool.query(`SELECT * FROM ${t} LIMIT 3`);
      console.log(`\n${t} (sample):`, JSON.stringify(r.rows, null, 2));
    } catch(e) { console.log(`${t}: error`, e.message); }
  }
  
  pool.end();
}
run();
