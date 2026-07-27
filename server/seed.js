require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check if the entity table already has an admin
    const checkRes = await client.query('SELECT * FROM entity WHERE fullname = $1', ['Admin User']);
    
    let eid;
    if (checkRes.rows.length === 0) {
      console.log('Creating Admin entity...');
      const insertEntity = await client.query(
        `INSERT INTO entity (roleid, fullname, gender, dateofbirth, phonenumber, createdat, lastedit)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING eid`,
        [1, 'Admin User', 'Male', '1990-01-01', '1234567890']
      );
      eid = insertEntity.rows[0].eid;
    } else {
      console.log('Admin entity already exists.');
      eid = checkRes.rows[0].eid;
    }

    // Check if useraccount already exists for this admin
    const checkUser = await client.query('SELECT * FROM useraccount WHERE email = $1', ['admin@example.com']);
    
    if (checkUser.rows.length === 0) {
      console.log('Creating Admin useraccount...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        `INSERT INTO useraccount (eid, username, email, passwordhash)
         VALUES ($1, $2, $3, $4)`,
        [eid, 'adminuser', 'admin@example.com', hashedPassword]
      );
      console.log('Admin useraccount created successfully: admin@example.com / admin123');
    } else {
      console.log('Admin useraccount already exists (admin@example.com). updating password just in case...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query('UPDATE useraccount SET passwordhash = $1 WHERE email = $2', [hashedPassword, 'admin@example.com']);
      console.log('Password reset to admin123');
    }

  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await client.end();
  }
}

seed();
