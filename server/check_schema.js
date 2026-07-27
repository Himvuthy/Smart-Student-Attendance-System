const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.dusubxmflzjyshtfoxmd:SmartATTSystem123@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres' });

client.connect().then(async () => {
  try {
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', res.rows.map(r=>r.table_name));
    
    const entRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'entity'");
    console.log('Entity columns:', entRes.rows);
    
    const userRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
    console.log('Users columns:', userRes.rows);
  } finally {
    client.end();
  }
});
