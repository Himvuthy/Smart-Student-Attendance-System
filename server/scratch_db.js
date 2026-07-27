const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.dusubxmflzjyshtfoxmd:SmartATTSystem123@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres' });

async function dump() {
  await client.connect();
  const tables = ['class', 'enrollment', 'attendance', 'student', 'session', 'schedule', 'lecturer', 'entity'];
  for (const t of tables) {
    const res = await client.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1', [t]);
    console.log(`--- ${t} ---`);
    console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  }
  await client.end();
}

dump().catch(console.error);
