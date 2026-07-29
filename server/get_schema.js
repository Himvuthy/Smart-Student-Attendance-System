require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`
  SELECT table_name, column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name IN ('class', 'schedule', 'session', 'attendance', 'biometriclog') 
  ORDER BY table_name, ordinal_position
`).then(res => {
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
