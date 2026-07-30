const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function deleteSessions() {
  try {
    await pool.query('BEGIN');
    
    // Delete attendance records for these sessions
    console.log('Deleting attendance records...');
    const res1 = await pool.query('DELETE FROM attendance WHERE sessionid IN (117, 71)');
    console.log(`Deleted ${res1.rowCount} attendance records.`);
    
    // Delete the sessions
    console.log('Deleting sessions...');
    const res2 = await pool.query('DELETE FROM session WHERE sessionid IN (117, 71)');
    console.log(`Deleted ${res2.rowCount} sessions.`);
    
    await pool.query('COMMIT');
    console.log('Successfully deleted the 2 PA sessions.');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error during deletion, rolled back:', err);
  } finally {
    await pool.end();
  }
}

deleteSessions();
