require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const query = `
  SELECT e.eid, e.fullname, u.email, e.phonenumber, s.studentid, b.biometricid
  FROM entity e
  JOIN student s ON e.eid = s.eid
  LEFT JOIN useraccount u ON e.eid = u.eid
  LEFT JOIN biometric b ON s.studentid = b.studentid
  ORDER BY s.studentid ASC
`;

pool.query(query)
  .then(res => {
    console.log(res.rows);
    pool.end();
  })
  .catch(err => {
    console.error('ERROR:', err);
    pool.end();
  });
