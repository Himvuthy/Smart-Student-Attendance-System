const { Pool } = require('pg');
require('dotenv').config();
const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const res = await p.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='class' ORDER BY ordinal_position"
  );
  console.log('class columns:', res.rows.map(x => x.column_name).join(', '));
  
  const res2 = await p.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='lecturer' ORDER BY ordinal_position"
  );
  console.log('lecturer columns:', res2.rows.map(x => x.column_name).join(', '));
  
  await p.end();
}
main().catch(e => { console.error(e); p.end(); });
