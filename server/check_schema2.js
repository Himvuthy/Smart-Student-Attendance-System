const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.dusubxmflzjyshtfoxmd:SmartATTSystem123@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres' });
client.connect().then(async () => {
  try {
    const uaRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'useraccount'");
    console.log('UserAccount columns:', uaRes.rows);
    
    const roleRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'role'");
    console.log('Role columns:', roleRes.rows);
  } finally {
    client.end();
  }
});
