const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkSessions() {
  try {
    const res = await pool.query(`
      SELECT s.sessionid, s.sessiondate, sch.subject, c.classcode, c.classname
      FROM session s
      JOIN schedule sch ON s.scheduleid = sch.scheduleid
      JOIN class c ON sch.classid = c.classid
      WHERE sch.subject = 'PA'
      ORDER BY s.sessiondate DESC
      LIMIT 10
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkSessions();
