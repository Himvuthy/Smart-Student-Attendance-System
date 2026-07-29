const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.dusubxmflzjyshtfoxmd:SmartATTSystem123@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("INSERT INTO lecturer (eid) SELECT eid FROM entity WHERE roleid = 2 AND eid NOT IN (SELECT eid FROM lecturer)");
    console.log("Inserted missing teachers into lecturer table! Count:", res.rowCount);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
