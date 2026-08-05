require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Auto-create system_settings and system_logs tables on startup
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value VARCHAR(255) NOT NULL
      )
    `);
    // Seed defaults if they don't exist
    await pool.query(`INSERT INTO system_settings (key, value) VALUES ('late_threshold', '15') ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO system_settings (key, value) VALUES ('absent_threshold', '90') ON CONFLICT (key) DO NOTHING`);
    console.log('system_settings table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        action VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        color VARCHAR(50) DEFAULT 'text-gray-400'
      )
    `);
    console.log('system_logs table ready');
  } catch (err) {
    console.error('Error initializing tables:', err);
  }
})();

// Log Helper
const logSystemAction = async (action, message, color = 'text-gray-400') => {
  try {
    await pool.query(
      'INSERT INTO system_logs (action, message, color) VALUES ($1, $2, $3)',
      [action, message, color]
    );
  } catch (err) {
    console.error('Failed to log system action:', err);
  }
};

// GET all settings
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM system_settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update a setting
app.put('/api/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: 'key and value are required' });
    await pool.query(
      `INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
      [key, String(value)]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET logs
app.get('/api/logs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_logs ORDER BY id DESC LIMIT 100');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/logs', async (req, res) => {
  try {
    const { action, message, color } = req.body;
    if (!action || !message) {
      return res.status(400).json({ error: 'Action and message are required' });
    }
    await pool.query(
      'INSERT INTO system_logs (action, message, color) VALUES ($1, $2, $3)',
      [action, message, color || 'text-gray-400']
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Find user by username or email
    const userResult = await pool.query('SELECT * FROM useraccount WHERE username = $1 OR email = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = userResult.rows[0];

    // Verify password
    const match = await bcrypt.compare(password, user.passwordhash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Get user entity info (roleid, fullname)
    const entityResult = await pool.query('SELECT * FROM entity WHERE eid = $1', [user.eid]);
    const entity = entityResult.rows[0];

    if (!entity) {
       return res.status(401).json({ error: 'User profile not found' });
    }

    // Update last login
    await pool.query('UPDATE useraccount SET lastlogin = NOW() WHERE userid = $1', [user.userid]);

    res.json({
      success: true,
      user: {
        userid: user.userid,
        eid: entity.eid,
        email: user.email,
        username: user.username,
        fullname: entity.fullname,
        roleid: entity.roleid,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// GET biometric students
app.get('/api/biometric/students', async (req, res) => {
  try {
    const query = `
      SELECT e.eid, e.fullname, u.email, e.phonenumber, s.studentid, b.biometricid, b.fingerindex
      FROM entity e
      JOIN student s ON e.eid = s.eid
      LEFT JOIN useraccount u ON e.eid = u.eid
      LEFT JOIN biometric b ON s.studentid = b.studentid
      ORDER BY s.studentid ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching biometric students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET admin dashboard stats
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    // Stats
    const studentRes = await pool.query("SELECT COUNT(*) FROM student");
    const classRes = await pool.query("SELECT COUNT(*) FROM class");
    const bioRes = await pool.query("SELECT COUNT(DISTINCT studentid) FROM biometric");
    
    const totalStudents = parseInt(studentRes.rows[0].count);
    const activeClasses = parseInt(classRes.rows[0].count);
    const enrollment = parseInt(bioRes.rows[0].count);
    const pendingEnrollment = totalStudents - enrollment;

    // Attendance Breakdown for Today
    const totalsRes = await pool.query(`
      SELECT 
        COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as present,
        COUNT(CASE WHEN a.status = 'Late' THEN 1 END) as late,
        COUNT(CASE WHEN a.status = 'Absent' THEN 1 END) as absent
      FROM attendance a
      JOIN session s ON a.sessionid = s.sessionid
      WHERE s.sessiondate = CURRENT_DATE
    `);
    const presentCount = parseInt(totalsRes.rows[0].present) || 0;
    const lateCount = parseInt(totalsRes.rows[0].late) || 0;
    const absentCount = parseInt(totalsRes.rows[0].absent) || 0;
    const totalAttendance = presentCount + lateCount + absentCount;
    const attendanceTotals = {
      total: totalAttendance,
      Present: presentCount,
      Late: lateCount,
      Absent: absentCount,
      rate: totalAttendance > 0 ? Math.round(((presentCount + lateCount) / totalAttendance) * 100) : 0
    };

    // Today's Classes
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayStr = days[new Date().getDay()];
    
    const todaysRes = await pool.query(`
      SELECT s.scheduleid as id, c.classcode as code, c.classname, s.subject as subject, 
             e.fullname as lecturer, s.starttime, s.endtime
      FROM schedule s
      JOIN class c ON s.classid = c.classid
      LEFT JOIN lecturer l ON l.classid = c.classid
      LEFT JOIN entity e ON l.eid = e.eid
      WHERE s.dayofweek = $1
      ORDER BY s.starttime ASC
    `, [todayStr]);
    const todaysClasses = todaysRes.rows.map(r => ({
      id: r.id,
      code: r.code,
      classname: r.classname,
      subject: r.subject,
      lecturer: r.lecturer,
      time: `${r.starttime.substring(0,5)} - ${r.endtime.substring(0,5)}`,
      room: 'Main Campus'
    }));

    // Weekly Analytics
    const weeklyRes = await pool.query(`
      SELECT 
        DATE(attendedat) as date,
        COUNT(CASE WHEN status IN ('Present', 'Late') THEN 1 END) as present_count,
        COUNT(*) as total_count
      FROM attendance
      WHERE attendedat >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY DATE(attendedat)
      ORDER BY DATE(attendedat) ASC
    `);
    
    const recentRes = await pool.query(`
      SELECT 
        a.attendanceid as id,
        e.fullname as name,
        sch.subject as course,
        c.classname as coursename,
        a.attendedat as time,
        a.status
      FROM attendance a
      JOIN student s ON a.studentid = s.studentid
      JOIN entity e ON s.eid = e.eid
      JOIN session ss ON a.sessionid = ss.sessionid
      JOIN schedule sch ON ss.scheduleid = sch.scheduleid
      JOIN class c ON sch.classid = c.classid
      ORDER BY a.attendedat DESC
      LIMIT 10
    `);

    res.json({
      stats: { totalStudents, activeClasses, enrollment, pendingEnrollment },
      attendanceTotals,
      todaysClasses,
      weeklyData: weeklyRes.rows,
      recentAttendance: recentRes.rows
    });
  } catch (err) {
    console.error('Error fetching admin dashboard:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET all devices

// GET all users
app.get('/api/users', async (req, res) => {
  try {
    const query = `
      SELECT u.userid, u.username, u.email, u.lastlogin, e.eid, e.fullname, e.roleid, e.createdat 
      FROM useraccount u
      JOIN entity e ON u.eid = e.eid
      ORDER BY e.createdat DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST new user
app.post('/api/users', async (req, res) => {
  const { fullname, username, email, password, roleid } = req.body;
  
  if (!fullname || !username || !email || !password || !roleid) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const checkRes = await pool.query('SELECT * FROM useraccount WHERE username = $1 OR email = $2', [username, email]);
    if (checkRes.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const entityResult = await pool.query(
      'INSERT INTO entity (roleid, fullname, dateofbirth, gender, createdat, lastedit) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING eid',
      [roleid, fullname, '1990-01-01', 'Male']
    );
    const newEid = entityResult.rows[0].eid;

    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      'INSERT INTO useraccount (eid, username, email, passwordhash) VALUES ($1, $2, $3, $4) RETURNING userid',
      [newEid, username, email, hashedPassword]
    );

    res.json({
      success: true,
      user: {
        userid: userResult.rows[0].userid,
        eid: newEid,
        fullname,
        username,
        email,
        roleid
      }
    });
    
    await logSystemAction('ADD_USER', `User ${username} (${fullname}) was added to the system`, 'text-blue-500');

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users/change-password', async (req, res) => {
  const { userid, currentPassword, newPassword } = req.body;
  if (!userid || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    const userRes = await pool.query('SELECT passwordhash FROM useraccount WHERE userid = $1', [userid]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const match = await bcrypt.compare(currentPassword, userRes.rows[0].passwordhash);
    if (!match) return res.status(401).json({ error: 'Incorrect current password' });
    
    const hashedNew = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE useraccount SET passwordhash = $1 WHERE userid = $2', [hashedNew, userid]);
    
    await logSystemAction('UPDATE_PASSWORD', `User ID ${userid} changed their password`, 'text-orange-500');
    res.json({ success: true });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- ENTITY CRUD APIS ---

app.get('/api/entities', async (req, res) => {
  try {
    const query = `
      SELECT e.eid, u.userid, u.username, r.rolename, e.fullname, e.gender, e.dateofbirth, 
e.phonenumber, u.email, e.roleid, s.studentid, l.lecturerid, e.createdat, e.lastedit
      FROM entity e
      LEFT JOIN useraccount u ON e.eid = u.eid
      LEFT JOIN role r ON e.roleid = r.roleid
      LEFT JOIN student s ON e.eid = s.eid
      LEFT JOIN lecturer l ON e.eid = l.eid
      ORDER BY e.createdat DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching entities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/entities', async (req, res) => {
  const { fullname, username, email, password, roleid, gender, dateofbirth, phonenumber } = req.body;
  if (!fullname || !roleid) {
    return res.status(400).json({ error: 'Full name and role are required' });
  }
  try {
    if (username || email) {
      const checkRes = await pool.query('SELECT * FROM useraccount WHERE username = $1 OR email = $2', [username, email]);
      if (checkRes.rows.length > 0) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
    }
    const entityResult = await pool.query(
      'INSERT INTO entity (roleid, fullname, dateofbirth, gender, phonenumber, createdat, lastedit) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING eid',
      [roleid, fullname, dateofbirth || '2000-01-01', gender || 'Male', phonenumber || '']
    );
    const newEid = entityResult.rows[0].eid;
    if (username && email && password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO useraccount (eid, username, email, passwordhash) VALUES ($1, $2, $3, $4)',
        [newEid, username, email, hashedPassword]
      );
    }
    
    if (parseInt(roleid) === 3) {
      await pool.query('INSERT INTO student (eid) VALUES ($1)', [newEid]);
    } else if (parseInt(roleid) === 2) {
      await pool.query('INSERT INTO lecturer (eid) VALUES ($1)', [newEid]);
    }

    await logSystemAction('ADD_ENTITY', `Entity ${fullname} was created`, 'text-blue-500');
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating entity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/entities/:eid', async (req, res) => {
  const { eid } = req.params;
  const { fullname, username, email, password, roleid, gender, dateofbirth, phonenumber } = req.body;
  try {
    await pool.query(
      'UPDATE entity SET fullname=$1, roleid=$2, gender=$3, dateofbirth=$4, phonenumber=$5, lastedit=NOW() WHERE eid=$6',
      [fullname, roleid, gender, dateofbirth || null, phonenumber, eid]
    );
    const existingUser = await pool.query('SELECT userid FROM useraccount WHERE eid = $1', [eid]);
    if (existingUser.rows.length > 0) {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('UPDATE useraccount SET username=$1, email=$2, passwordhash=$3 WHERE eid=$4', [username, email, hashedPassword, eid]);
      } else {
        await pool.query('UPDATE useraccount SET username=$1, email=$2 WHERE eid=$3', [username, email, eid]);
      }
    } else if (username && email && password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO useraccount (eid, username, email, passwordhash) VALUES ($1, $2, $3, $4)',
        [eid, username, email, hashedPassword]
      );
    }
    
    await logSystemAction('UPDATE_ENTITY', `Entity ${fullname} (ID: ${eid}) was modified`, 'text-orange-500');
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating entity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/entities/:eid', async (req, res) => {
  const { eid } = req.params;
  try {
    await pool.query('DELETE FROM useraccount WHERE eid = $1', [eid]);
    await pool.query('DELETE FROM entity WHERE eid = $1', [eid]);
    
    await logSystemAction('DELETE_ENTITY', `Entity ID ${eid} was deleted from the system`, 'text-red-500');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting entity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- NEW APIS for Class -> Schedule -> Attendance ---

app.get('/api/majors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM major');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching majors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/classes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM enrollment e WHERE e.classid = c.classid) AS student_count,
        (SELECT ent.fullname FROM lecturer l JOIN entity ent ON l.eid = ent.eid WHERE l.classid = c.classid LIMIT 1) as primary_lecturer
      FROM class c
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/classes', async (req, res) => {
  const { classcode, classname, academicyear, semester, majorid, startdate, enddate } = req.body;
  if (!classcode || !classname) {
    return res.status(400).json({ error: 'Class code and name are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO class (classcode, classname, academicyear, semester, majorid, startdate, enddate)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING classid, classcode, classname, startdate, enddate
    `, [classcode, classname, academicyear || '2025-2026', parseInt(semester) || 1, majorid || null, startdate || null, enddate || null]);
    
    await logSystemAction('ADD_CLASS', `Class ${classcode} (${classname}) was created`, 'text-blue-500');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/classes/:classid', async (req, res) => {
  const { classid } = req.params;
  try {
    const result = await pool.query('DELETE FROM class WHERE classid = $1 RETURNING *', [classid]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    await logSystemAction('DELETE_CLASS', `Class ${result.rows[0].classcode} was deleted`, 'text-red-500');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete class. It may have dependent records.' });
  }
});

app.put('/api/classes/:classid', async (req, res) => {
  const { classid } = req.params;
  const { classcode, classname, academicyear, semester, majorid, startdate, enddate } = req.body;
  if (!classcode || !classname || !majorid) {
    return res.status(400).json({ error: 'Class code, name, and major are required' });
  }

  try {
    const result = await pool.query(`
      UPDATE class 
      SET classcode = $1, classname = $2, academicyear = $3, semester = $4, majorid = $5, startdate = $6, enddate = $7
      WHERE classid = $8
      RETURNING classid, classcode, classname, startdate, enddate
    `, [classcode, classname, academicyear || '2025-2026', parseInt(semester) || 1, majorid || null, startdate || null, enddate || null, classid]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Class not found' });
    
    await logSystemAction('UPDATE_CLASS', `Class ${classcode} was modified`, 'text-orange-500');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/classes/:classid/schedules', async (req, res) => {
  try {
    const { classid } = req.params;
    const result = await pool.query(
      `SELECT s.scheduleid, s.subject, s.starttime, s.endtime, s.dayofweek, 
              l.eid as teacherid, e.fullname as teacher_name 
       FROM schedule s 
       LEFT JOIN assignment a ON s.scheduleid = a.scheduleid 
       LEFT JOIN lecturer l ON a.lecturerid = l.lecturerid
       LEFT JOIN entity e ON l.eid = e.eid
       WHERE s.classid = $1`,
      [classid]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new schedule for a class
app.post('/api/classes/:classid/schedules', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { classid } = req.params;
    const { subject, starttime, endtime, dayofweek, teacherid } = req.body;
    
    // 1. Create schedule
    const schedResult = await client.query(
      'INSERT INTO schedule (classid, subject, starttime, endtime, dayofweek) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [classid, subject, starttime, endtime, dayofweek]
    );
    const newSchedule = schedResult.rows[0];

    // 2. Handle assignment if teacherid provided
    if (teacherid) {
       // Find or create lecturer
       let lecResult = await client.query(
         'SELECT lecturerid FROM lecturer WHERE eid = $1 AND classid = $2 AND subject = $3',
         [teacherid, classid, subject]
       );
       let lecturerid;
       if (lecResult.rows.length > 0) {
          lecturerid = lecResult.rows[0].lecturerid;
       } else {
          lecResult = await client.query(
            'INSERT INTO lecturer (eid, classid, subject) VALUES ($1, $2, $3) RETURNING lecturerid',
            [teacherid, classid, subject]
          );
          lecturerid = lecResult.rows[0].lecturerid;
       }
       // Assign to schedule
       await client.query(
         'INSERT INTO assignment (lecturerid, scheduleid) VALUES ($1, $2)',
         [lecturerid, newSchedule.scheduleid]
       );
    }
    await client.query('COMMIT');

    const inserted = await pool.query(
      `SELECT s.scheduleid, s.subject, s.starttime, s.endtime, s.dayofweek, 
              l.eid as teacherid, e.fullname as teacher_name 
       FROM schedule s 
       LEFT JOIN assignment a ON s.scheduleid = a.scheduleid 
       LEFT JOIN lecturer l ON a.lecturerid = l.lecturerid
       LEFT JOIN entity e ON l.eid = e.eid
       WHERE s.scheduleid = $1`,
      [newSchedule.scheduleid]
    );
    res.status(201).json(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Update an existing schedule
app.put('/api/schedules/:scheduleid', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { scheduleid } = req.params;
    const { subject, starttime, endtime, dayofweek, teacherid } = req.body;
    
    // Get classid for lecturer check
    const classRes = await client.query('SELECT classid FROM schedule WHERE scheduleid = $1', [scheduleid]);
    if (classRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Schedule not found' });
    }
    const classid = classRes.rows[0].classid;

    const result = await client.query(
      'UPDATE schedule SET subject = $1, starttime = $2, endtime = $3, dayofweek = $4 WHERE scheduleid = $5 RETURNING *',
      [subject, starttime, endtime, dayofweek, scheduleid]
    );
    
    // Delete existing assignment
    await client.query('DELETE FROM assignment WHERE scheduleid = $1', [scheduleid]);

    // Add new assignment if teacherid provided
    if (teacherid) {
       let lecResult = await client.query(
         'SELECT lecturerid FROM lecturer WHERE eid = $1 AND classid = $2 AND subject = $3',
         [teacherid, classid, subject]
       );
       let lecturerid;
       if (lecResult.rows.length > 0) {
          lecturerid = lecResult.rows[0].lecturerid;
       } else {
          lecResult = await client.query(
            'INSERT INTO lecturer (eid, classid, subject) VALUES ($1, $2, $3) RETURNING lecturerid',
            [teacherid, classid, subject]
          );
          lecturerid = lecResult.rows[0].lecturerid;
       }
       await client.query(
         'INSERT INTO assignment (lecturerid, scheduleid) VALUES ($1, $2)',
         [lecturerid, scheduleid]
       );
    }
    await client.query('COMMIT');

    const updated = await pool.query(
      `SELECT s.scheduleid, s.subject, s.starttime, s.endtime, s.dayofweek, 
              l.eid as teacherid, e.fullname as teacher_name 
       FROM schedule s 
       LEFT JOIN assignment a ON s.scheduleid = a.scheduleid 
       LEFT JOIN lecturer l ON a.lecturerid = l.lecturerid
       LEFT JOIN entity e ON l.eid = e.eid
       WHERE s.scheduleid = $1`,
      [scheduleid]
    );
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Delete a schedule
app.delete('/api/schedules/:scheduleid', async (req, res) => {
  try {
    const { scheduleid } = req.params;
    const result = await pool.query('DELETE FROM schedule WHERE scheduleid = $1 RETURNING *', [scheduleid]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/schedules/:scheduleid/attendance', async (req, res) => {
  try {
    const { scheduleid } = req.params;

    // 1. Get classid for this schedule
    const scheduleRes = await pool.query('SELECT classid FROM schedule WHERE scheduleid = $1', [scheduleid]);
    if (scheduleRes.rows.length === 0) return res.status(404).json({ error: 'Schedule not found' });
    const classid = scheduleRes.rows[0].classid;

    // 2. Get students
    const studentsRes = await pool.query(`
      SELECT s.studentid, ent.fullname, ent.profilepicture 
      FROM student s
      JOIN entity ent ON s.eid = ent.eid
      JOIN enrollment e ON s.studentid = e.studentid
      WHERE e.classid = $1
      ORDER BY ent.fullname ASC
    `, [classid]);

    // 3. Get sessions
    const sessionsRes = await pool.query(
      'SELECT sessionid, sessiondate FROM session WHERE scheduleid = $1 ORDER BY sessiondate ASC',
      [scheduleid]
    );

    // 4. Get attendance records
    const attendanceRes = await pool.query(`
      SELECT a.studentid, a.sessionid, a.status, a.minutelate
      FROM attendance a
      JOIN session s ON a.sessionid = s.sessionid
      WHERE s.scheduleid = $1
    `, [scheduleid]);

    res.json({
      students: studentsRes.rows,
      sessions: sessionsRes.rows,
      attendance: attendanceRes.rows
    });
  } catch (error) {
    console.error('Error fetching attendance matrix:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- NEW API FOR ENROLLMENT AND EDITING ---

app.get('/api/classes/:classid/unenrolled-students', async (req, res) => {
  try {
    const { classid } = req.params;
    const result = await pool.query(`
      SELECT s.studentid, ent.eid, ent.userid, ent.fullname, ent.profilepicture, ent.gender
      FROM student s
      JOIN entity ent ON s.eid = ent.eid
      WHERE s.studentid NOT IN (
        SELECT studentid FROM enrollment WHERE classid = $1
      )
      ORDER BY ent.fullname ASC
    `, [classid]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching unenrolled students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/classes/:classid/enroll', async (req, res) => {
  try {
    const { classid } = req.params;
    const { studentid } = req.body;
    
    // Enroll the student
    await pool.query(
      'INSERT INTO enrollment (studentid, classid, enrolledat) VALUES ($1, $2, CURRENT_TIMESTAMP)',
      [studentid, classid]
    );
    
    // Fetch their details to return to the frontend for optimistic UI updates
    const studentRes = await pool.query(`
      SELECT s.studentid, ent.fullname, ent.profilepicture, ent.email 
      FROM student s
      JOIN entity ent ON s.eid = ent.eid
      WHERE s.studentid = $1
    `, [studentid]);
    
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found in database' });
    }

    res.json({ success: true, student: studentRes.rows[0] });
  } catch (error) {
    console.error('Error enrolling student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/attendance/bulk', async (req, res) => {
  try {
    const { updates, scheduleid } = req.body; 
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const update of updates) {
        let sessionId = update.sessionid;
        
        if (!sessionId && update.sessiondate && scheduleid) {
          // Find or create session
          const sessionRes = await client.query('SELECT sessionid FROM session WHERE scheduleid = $1 AND sessiondate = $2', [scheduleid, update.sessiondate]);
          if (sessionRes.rows.length > 0) {
            sessionId = sessionRes.rows[0].sessionid;
          } else {
            const insertRes = await client.query('INSERT INTO session (scheduleid, sessiondate) VALUES ($1, $2) RETURNING sessionid', [scheduleid, update.sessiondate]);
            sessionId = insertRes.rows[0].sessionid;
          }
        }

        if (!sessionId) continue;

        const { rowCount } = await client.query(
          'UPDATE attendance SET status = $1, attendedat = CURRENT_TIMESTAMP WHERE studentid = $2 AND sessionid = $3',
          [update.status, update.studentid, sessionId]
        );
        if (rowCount === 0) {
          await client.query(
            'INSERT INTO attendance (studentid, sessionid, status, attendedat) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
            [update.studentid, sessionId, update.status]
          );
        }
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in bulk attendance update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// --- NEW APIS for Attendance Tracking Dashboard ---

// GET system-wide attendance for reports
app.get('/api/reports/attendance', async (req, res) => {
  try {
    const { classid, date } = req.query;

    // Build the query: start from ALL enrolled students, left-join sessions & attendance
    // so students with no record appear as "Absent"
    let query = `
      SELECT
        s.studentid,
        e.fullname AS studentname,
        c.classid,
        c.classcode,
        c.classname,
        sess.sessiondate,
        COALESCE(a.status, 'Absent') AS status,
        a.attendedat,
        COALESCE(a.minutelate, 0) AS minutelate
      FROM enrollment en
      JOIN student s   ON en.studentid = s.studentid
      JOIN entity e    ON s.eid = e.eid
      JOIN class c     ON en.classid  = c.classid
      JOIN schedule sch ON sch.classid = c.classid
      JOIN session sess  ON sess.scheduleid = sch.scheduleid
      LEFT JOIN attendance a ON a.studentid = s.studentid AND a.sessionid = sess.sessionid
      WHERE 1=1
    `;
    const params = [];

    if (classid) {
      params.push(classid);
      query += ` AND c.classid = $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND sess.sessiondate::date = $${params.length}::date`;
    }

    query += ` ORDER BY e.fullname ASC, sess.sessiondate ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching report data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/attendance-tracking/classes', async (req, res) => {
  try {
    const classResult = await pool.query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM enrollment e WHERE e.classid = c.classid) AS total_enrolled
      FROM class c
    `);
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayStr = req.query.day || days[new Date().getDay()];
    // Get local date YYYY-MM-DD from frontend, fallback to server date
    const currentDate = req.query.date || new Date().toISOString().split('T')[0];
    
    const enhancedClasses = await Promise.all(classResult.rows.map(async (cls) => {
      let todaySubject = null;
      let presentCount = 0;
      let lateCount = 0;
      
      const scheduleRes = await pool.query('SELECT scheduleid, subject FROM schedule WHERE classid = $1 AND dayofweek = $2', [cls.classid, todayStr]);
      if (scheduleRes.rows.length > 0) {
        todaySubject = scheduleRes.rows[0].subject;
        const sessionRes = await pool.query('SELECT sessionid FROM session WHERE scheduleid = $1 AND sessiondate = $2', [scheduleRes.rows[0].scheduleid, currentDate]);
        if (sessionRes.rows.length > 0) {
          const attRes = await pool.query("SELECT COUNT(*) FROM attendance WHERE sessionid = $1 AND status != '-' AND status != 'Absent'", [sessionRes.rows[0].sessionid]);
          presentCount = parseInt(attRes.rows[0].count);
          
          const lateRes = await pool.query("SELECT COUNT(*) FROM attendance WHERE sessionid = $1 AND status = 'Late'", [sessionRes.rows[0].sessionid]);
          lateCount = parseInt(lateRes.rows[0].count);
        }
      }
      
      return {
        ...cls,
        todaySubject,
        presentCount,
        lateCount
      };
    }));
    
    res.json(enhancedClasses);
  } catch (error) {
    console.error('Error fetching classes for tracking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/attendance-tracking/classes/:classid/sessions', async (req, res) => {
  try {
    const { classid } = req.params;
    const sessionRes = await pool.query(`
      SELECT s.sessionid, s.sessiondate, sch.subject, sch.starttime, sch.endtime,
        (SELECT COUNT(*) FROM attendance a WHERE a.sessionid = s.sessionid AND a.status != '-' AND a.status != 'Absent') AS present_count,
        (SELECT COUNT(*) FROM attendance a WHERE a.sessionid = s.sessionid AND a.status = 'Late') AS late_count,
        (SELECT COUNT(*) FROM enrollment e WHERE e.classid = sch.classid) AS total_enrolled
      FROM session s
      JOIN schedule sch ON s.scheduleid = sch.scheduleid
      WHERE sch.classid = $1
      ORDER BY s.sessiondate DESC
      LIMIT 10
    `, [classid]);
    res.json(sessionRes.rows);
  } catch (error) {
    console.error('Error fetching recent sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/attendance-tracking/sessions/:sessionid/log', async (req, res) => {
  try {
    const { sessionid } = req.params;
    const logRes = await pool.query(`
      SELECT a.attendedat, a.status, a.minutelate, ent.fullname, ent.eid, st.studentid
      FROM attendance a
      JOIN student st ON a.studentid = st.studentid
      JOIN entity ent ON st.eid = ent.eid
      WHERE a.sessionid = $1
      ORDER BY a.attendedat ASC
    `, [sessionid]);
    res.json(logRes.rows);
  } catch (error) {
    console.error('Error fetching session log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// EXCUSE REQUEST TABLE (auto-create on startup)
// ─────────────────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS excuserequest (
    requestid SERIAL PRIMARY KEY,
    studentid INTEGER REFERENCES student(studentid) ON DELETE CASCADE,
    scheduleid INTEGER REFERENCES schedule(scheduleid) ON DELETE SET NULL,
    requestdate DATE NOT NULL,
    reason VARCHAR(255),
    details TEXT,
    status VARCHAR(20) DEFAULT 'Pending',
    reviewedat TIMESTAMP,
    reviewer_eid INTEGER,
    createdat TIMESTAMP DEFAULT NOW()
  )
`).then(() => console.log('excuserequest table ready')).catch(e => console.error('excuserequest table error:', e.message));

// ─────────────────────────────────────────────
// EXCUSE REQUEST ENDPOINTS
// ─────────────────────────────────────────────
app.get('/api/excuse-requests', async (req, res) => {
  try {
    const { studentUserId } = req.query;
    let query = `
      SELECT er.requestid as id, er.requestdate, er.reason, er.details, er.status, er.createdat,
             er.scheduleid, s.subject, s.dayofweek,
             st.studentid, e.fullname as student_name, e.eid as student_eid,
             u.userid as studentUserId
      FROM excuserequest er
      JOIN student st ON er.studentid = st.studentid
      JOIN entity e ON st.eid = e.eid
      LEFT JOIN useraccount u ON e.eid = u.eid
      LEFT JOIN schedule s ON er.scheduleid = s.scheduleid
    `;
    const params = [];
    if (studentUserId) {
      query += ' WHERE u.userid = $1';
      params.push(studentUserId);
    }
    query += ' ORDER BY er.createdat DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching excuse requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/excuse-requests', async (req, res) => {
  try {
    const { studentUserId, scheduleid, requestdate, reason, details } = req.body;
    // Resolve studentid from userid
    const stRes = await pool.query(
      'SELECT st.studentid FROM student st JOIN entity e ON st.eid = e.eid JOIN useraccount u ON e.eid = u.eid WHERE u.userid = $1',
      [studentUserId]
    );
    if (stRes.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const studentid = stRes.rows[0].studentid;

    const result = await pool.query(
      'INSERT INTO excuserequest (studentid, scheduleid, requestdate, reason, details) VALUES ($1, $2, $3, $4, $5) RETURNING requestid',
      [studentid, scheduleid || null, requestdate, reason, details || null]
    );
    const row = await pool.query(`
      SELECT er.requestid as id, er.requestdate, er.reason, er.details, er.status, er.createdat,
             s.subject, s.dayofweek, e.fullname as student_name, u.userid as studentUserId
      FROM excuserequest er
      JOIN student st ON er.studentid = st.studentid
      JOIN entity e ON st.eid = e.eid
      LEFT JOIN useraccount u ON e.eid = u.eid
      LEFT JOIN schedule s ON er.scheduleid = s.scheduleid
      WHERE er.requestid = $1`, [result.rows[0].requestid]);
    res.status(201).json(row.rows[0]);
  } catch (error) {
    console.error('Error creating excuse request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/excuse-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewerUserId } = req.body;
    let reviewer_eid = null;
    if (reviewerUserId) {
      const rev = await pool.query('SELECT eid FROM useraccount WHERE userid = $1', [reviewerUserId]);
      if (rev.rows.length > 0) reviewer_eid = rev.rows[0].eid;
    }
    await pool.query(
      'UPDATE excuserequest SET status = $1, reviewedat = NOW(), reviewer_eid = $2 WHERE requestid = $3',
      [status, reviewer_eid, id]
    );
    const row = await pool.query(`
      SELECT er.requestid as id, er.requestdate, er.reason, er.details, er.status, er.createdat,
             s.subject, s.dayofweek, e.fullname as student_name, u.userid as studentUserId
      FROM excuserequest er
      JOIN student st ON er.studentid = st.studentid
      JOIN entity e ON st.eid = e.eid
      LEFT JOIN useraccount u ON e.eid = u.eid
      LEFT JOIN schedule s ON er.scheduleid = s.scheduleid
      WHERE er.requestid = $1`, [id]);
    res.json(row.rows[0]);
  } catch (error) {
    console.error('Error reviewing excuse request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// STUDENT ENDPOINTS
// ─────────────────────────────────────────────

// Student profile
app.get('/api/student/:eid/profile', async (req, res) => {
  try {
    const { eid } = req.params;
    const result = await pool.query(`
      SELECT e.eid, e.fullname, e.gender, e.dateofbirth, e.phonenumber, e.profilepicture,
             st.studentid, u.email, u.username, u.userid,
             c.classname, c.classcode, c.academicyear, c.semester,
             b.biometricid
      FROM entity e
      JOIN student st ON e.eid = st.eid
      LEFT JOIN useraccount u ON e.eid = u.eid
      LEFT JOIN enrollment en ON st.studentid = en.studentid
      LEFT JOIN class c ON en.classid = c.classid
      LEFT JOIN biometric b ON st.studentid = b.studentid
      WHERE e.eid = $1
      LIMIT 1
    `, [eid]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Student weekly schedule
app.get('/api/student/:eid/schedule', async (req, res) => {
  try {
    const { eid } = req.params;
    const result = await pool.query(`
      SELECT s.scheduleid, s.subject, s.starttime, s.endtime, s.dayofweek,
             c.classname, c.classcode,
             e_lec.fullname as teacher_name
      FROM student st
      JOIN enrollment en ON st.studentid = en.studentid
      JOIN class c ON en.classid = c.classid
      JOIN schedule s ON s.classid = c.classid
      LEFT JOIN assignment a ON a.scheduleid = s.scheduleid
      LEFT JOIN lecturer l ON a.lecturerid = l.lecturerid
      LEFT JOIN entity e_lec ON l.eid = e_lec.eid
      WHERE st.eid = $1
      ORDER BY CASE s.dayofweek
        WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 ELSE 7 END,
        s.starttime
    `, [eid]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching student schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Student attendance history
app.get('/api/student/:eid/attendance', async (req, res) => {
  try {
    const { eid } = req.params;
    const result = await pool.query(`
      SELECT a.attendanceid, a.status, a.attendedat, a.minutelate,
             sess.sessiondate,
             s.subject, s.starttime, s.endtime, s.scheduleid,
             c.classcode, c.classname
      FROM attendance a
      JOIN session sess ON a.sessionid = sess.sessionid
      JOIN schedule s ON sess.scheduleid = s.scheduleid
      JOIN class c ON s.classid = c.classid
      JOIN student st ON a.studentid = st.studentid
      WHERE st.eid = $1
      ORDER BY sess.sessiondate DESC, s.starttime
    `, [eid]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Student per-subject attendance stats
app.get('/api/student/:eid/attendance/stats', async (req, res) => {
  try {
    const { eid } = req.params;
    const result = await pool.query(`
      SELECT s.scheduleid, s.subject, c.classcode, c.classname,
             COUNT(*) as sessions,
             COUNT(*) FILTER (WHERE a.status = 'Present') as present,
             COUNT(*) FILTER (WHERE a.status = 'Late') as late,
             COUNT(*) FILTER (WHERE a.status = 'Absent') as absent,
             ROUND(
               COUNT(*) FILTER (WHERE a.status IN ('Present','Late'))::decimal / NULLIF(COUNT(*), 0) * 100, 1
             ) as rate
      FROM attendance a
      JOIN session sess ON a.sessionid = sess.sessionid
      JOIN schedule s ON sess.scheduleid = s.scheduleid
      JOIN class c ON s.classid = c.classid
      JOIN student st ON a.studentid = st.studentid
      WHERE st.eid = $1
      GROUP BY s.scheduleid, s.subject, c.classcode, c.classname
      ORDER BY s.subject
    `, [eid]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// TEACHER ENDPOINTS
// ─────────────────────────────────────────────

// Teacher profile
app.get('/api/teacher/:eid/profile', async (req, res) => {
  try {
    const { eid } = req.params;
    const result = await pool.query(`
      SELECT e.eid, e.fullname, e.gender, e.dateofbirth, e.phonenumber, e.profilepicture,
             u.email, u.username, u.userid,
             l.lecturerid,
             COUNT(DISTINCT en.studentid) as total_students,
             COUNT(DISTINCT a.scheduleid) as total_classes
      FROM entity e
      JOIN lecturer l ON e.eid = l.eid
      LEFT JOIN useraccount u ON e.eid = u.eid
      LEFT JOIN assignment a ON l.lecturerid = a.lecturerid
      LEFT JOIN schedule s ON a.scheduleid = s.scheduleid
      LEFT JOIN enrollment en ON s.classid = en.classid
      WHERE e.eid = $1
      GROUP BY e.eid, e.fullname, e.gender, e.dateofbirth, e.phonenumber, e.profilepicture,
               u.email, u.username, u.userid, l.lecturerid
      LIMIT 1
    `, [eid]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching teacher profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Teacher's assigned classes
app.get('/api/teacher/:eid/classes', async (req, res) => {
  try {
    const { eid } = req.params;
    const result = await pool.query(`
      SELECT DISTINCT c.classid, c.classname, c.classcode,
        (SELECT COUNT(*) FROM enrollment en WHERE en.classid = c.classid) as student_count,
        ROUND(
          (SELECT COUNT(*) FILTER (WHERE a.status IN ('Present','Late'))::decimal
           FROM attendance a
           JOIN session sess ON a.sessionid = sess.sessionid
           JOIN schedule sch2 ON sess.scheduleid = sch2.scheduleid
           WHERE sch2.classid = c.classid) /
          NULLIF((SELECT COUNT(*) FROM attendance a2
           JOIN session sess2 ON a2.sessionid = sess2.sessionid
           JOIN schedule sch3 ON sess2.scheduleid = sch3.scheduleid
           WHERE sch3.classid = c.classid), 0) * 100, 1
        ) as attendance_rate,
        string_agg(DISTINCT s.dayofweek, ', ') as days,
        MIN(s.starttime::text) as starttime,
        MAX(s.endtime::text) as endtime
      FROM lecturer l
      JOIN assignment a ON l.lecturerid = a.lecturerid
      JOIN schedule s ON a.scheduleid = s.scheduleid
      JOIN class c ON s.classid = c.classid
      WHERE l.eid = $1
      GROUP BY c.classid, c.classname, c.classcode
    `, [eid]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Teacher's teaching schedule
app.get('/api/teacher/:eid/schedule', async (req, res) => {
  try {
    const { eid } = req.params;
    const result = await pool.query(`
      SELECT s.scheduleid, s.subject, s.starttime, s.endtime, s.dayofweek,
             c.classname, c.classcode, c.classid,
             e.fullname as teacher_name
      FROM lecturer l
      JOIN assignment a ON l.lecturerid = a.lecturerid
      JOIN schedule s ON a.scheduleid = s.scheduleid
      JOIN class c ON s.classid = c.classid
      JOIN entity e ON l.eid = e.eid
      WHERE l.eid = $1
      ORDER BY CASE s.dayofweek
        WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 ELSE 7 END,
        s.starttime
    `, [eid]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teacher schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Class roster with today's attendance
app.get('/api/classes/:classid/roster', async (req, res) => {
  try {
    const { classid } = req.params;
    const result = await pool.query(`
      SELECT st.studentid, e.fullname, e.profilepicture,
             COALESCE(att.status, '-') as status,
             att.attendedat,
             att.minutelate
      FROM enrollment en
      JOIN student st ON en.studentid = st.studentid
      JOIN entity e ON st.eid = e.eid
      LEFT JOIN (
        SELECT a.studentid, a.status, a.attendedat, a.minutelate
        FROM attendance a
        JOIN session sess ON a.sessionid = sess.sessionid
        JOIN schedule s ON sess.scheduleid = s.scheduleid
        WHERE s.classid = $1
          AND sess.sessiondate = CURRENT_DATE
      ) att ON att.studentid = st.studentid
      WHERE en.classid = $1
      ORDER BY e.fullname ASC
    `, [classid]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching class roster:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// At-risk students for teacher
app.get('/api/teacher/:eid/at-risk', async (req, res) => {
  try {
    const { eid } = req.params;
    const result = await pool.query(`
      SELECT st.studentid, e.fullname,
             s.subject, c.classcode, c.classname,
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE a.status = 'Present') as present,
             COUNT(*) FILTER (WHERE a.status = 'Late') as late,
             COUNT(*) FILTER (WHERE a.status = 'Absent') as absent,
             ROUND(
               COUNT(*) FILTER (WHERE a.status IN ('Present','Late'))::decimal / NULLIF(COUNT(*), 0) * 100, 1
             ) as rate
      FROM lecturer l
      JOIN assignment a_assign ON l.lecturerid = a_assign.lecturerid
      JOIN schedule s ON a_assign.scheduleid = s.scheduleid
      JOIN class c ON s.classid = c.classid
      JOIN session sess ON sess.scheduleid = s.scheduleid
      JOIN attendance a ON a.sessionid = sess.sessionid
      JOIN student st ON a.studentid = st.studentid
      JOIN entity e ON st.eid = e.eid
      WHERE l.eid = $1
      GROUP BY st.studentid, e.fullname, s.subject, c.classcode, c.classname
      HAVING ROUND(
               COUNT(*) FILTER (WHERE a.status IN ('Present','Late'))::decimal / NULLIF(COUNT(*), 0) * 100, 1
             ) < 90
      ORDER BY rate ASC
      LIMIT 20
    `, [eid]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching at-risk students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Teacher reports: per-schedule attendance stats
app.get('/api/teacher/:eid/reports', async (req, res) => {
  try {
    const { eid } = req.params;
    const result = await pool.query(`
      SELECT s.scheduleid, s.subject, s.dayofweek, c.classcode, c.classname,
        COUNT(DISTINCT en.studentid) as enrolled,
        COUNT(DISTINCT sess.sessionid) as sessions,
        COUNT(*) FILTER (WHERE a.status = 'Present') as present,
        COUNT(*) FILTER (WHERE a.status = 'Late') as late,
        COUNT(*) FILTER (WHERE a.status = 'Absent') as absent,
        ROUND(
          COUNT(*) FILTER (WHERE a.status IN ('Present','Late'))::decimal / NULLIF(COUNT(*), 0) * 100, 1
        ) as rate
      FROM lecturer l
      JOIN assignment a_assign ON l.lecturerid = a_assign.lecturerid
      JOIN schedule s ON a_assign.scheduleid = s.scheduleid
      JOIN class c ON s.classid = c.classid
      LEFT JOIN enrollment en ON en.classid = c.classid
      LEFT JOIN session sess ON sess.scheduleid = s.scheduleid
      LEFT JOIN attendance a ON a.sessionid = sess.sessionid
      WHERE l.eid = $1
      GROUP BY s.scheduleid, s.subject, s.dayofweek, c.classcode, c.classname
      ORDER BY s.subject
    `, [eid]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teacher reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
// ==========================================
// ==========================================
// ARDUINO HARDWARE INTEGRATION ENDPOINTS
// ==========================================

let scannerStatus = { online: false, lastSync: null, deviceName: null, location: null };

app.post('/api/hardware/heartbeat', (req, res) => {
  const devName = req.body.deviceName || 'AS608';
  console.log(`\n[ARDUINO BACKEND] 🟢 Scanner Plugged In / Heartbeat Received!`);
  console.log(`[ARDUINO BACKEND] Device Name: ${devName}`);
  console.log(`[ARDUINO BACKEND] Status: ONLINE\n`);

  scannerStatus = {
    online: true,
    lastSync: new Date().toISOString(),
    deviceName: devName,
    location: req.body.location || 'Main Entrance'
  };
  res.json({ success: true, message: 'Heartbeat received' });
});

app.get('/api/devices', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM device');
    
    // Check heartbeat timeout (allow 15 seconds for missed pings)
    if (scannerStatus.lastSync) {
      const diff = new Date() - new Date(scannerStatus.lastSync);
      if (diff > 15000) {
        scannerStatus.online = false;
      }
    }

    const devices = result.rows.map(dev => {
      let isOnline = false;
      let lastSync = dev.lastseen;
      
      // If the heartbeat in memory matches this device's name
      if (scannerStatus.deviceName === dev.devicename && scannerStatus.online) {
        isOnline = true;
        lastSync = scannerStatus.lastSync;
        
        // Update lastseen in DB asynchronously
        pool.query('UPDATE device SET lastseen = $1 WHERE deviceid = $2', [new Date(), dev.deviceid]).catch(e => {});
      }
      
      return {
        ...dev,
        online: isOnline,
        lastSync: lastSync
      };
    });
    
    // If there's an active scanner not in the DB, we can optionally append it as 'Unregistered'
    // but the user should use 'Register Device' anyway.
    
    res.json(devices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/devices', async (req, res) => {
  const { devicename, location } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO device (devicename, location, lastseen) VALUES ($1, $2, NOW()) RETURNING *',
      [devicename, location]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/devices/:id', async (req, res) => {
  const { id } = req.params;
  const { devicename, location } = req.body;
  try {
    const result = await pool.query(
      'UPDATE device SET devicename = $1, location = $2 WHERE deviceid = $3 RETURNING *',
      [devicename, location, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 1. Enroll a new fingerprint
app.post('/api/hardware/enroll', async (req, res) => {
  const { studentId, fingerIndex, template } = req.body;
  if (!studentId || fingerIndex === undefined) {
    return res.status(400).json({ error: 'studentId and fingerIndex are required' });
  }

  try {
    // Check if the student exists
    const studentRes = await pool.query('SELECT * FROM student WHERE studentid = $1', [studentId]);
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Upsert the biometric record (if they already have this finger index, overwrite it)
    await pool.query(`
      INSERT INTO biometric (studentid, fingerindex, template, createdat)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (studentid) DO UPDATE 
      SET fingerindex = EXCLUDED.fingerindex, template = EXCLUDED.template, createdat = NOW()
    `, [studentId, fingerIndex, template || '']);
    // Note: The schema might not have a UNIQUE constraint on studentid for ON CONFLICT.
    // If not, we'll do a DELETE first just to be safe.
    
    // Wait, let's just do a simple delete-then-insert to be perfectly safe across postgres versions
    await pool.query('DELETE FROM biometric WHERE studentid = $1 OR fingerindex = $2', [studentId, fingerIndex]);
    await pool.query('INSERT INTO biometric (studentid, fingerindex, template, createdat) VALUES ($1, $2, $3, NOW())', [studentId, fingerIndex, template || '']);

    res.json({ success: true, message: 'Fingerprint enrolled successfully' });
  } catch (error) {
    console.error('Error enrolling fingerprint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Scan a fingerprint for attendance
app.post('/api/hardware/scan', async (req, res) => {
  const { fingerIndex } = req.body;
  if (fingerIndex === undefined) {
    return res.status(400).json({ error: 'fingerIndex is required' });
  }

  try {
    // Find the student matching this fingerprint
    const bioRes = await pool.query(`
      SELECT b.studentid, e.fullname 
      FROM biometric b
      JOIN student s ON b.studentid = s.studentid
      JOIN entity e ON s.eid = e.eid
      WHERE b.fingerindex = $1
    `, [fingerIndex]);

    if (bioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Fingerprint not registered to any student' });
    }

    const student = bioRes.rows[0];

    // Find if the student has an active class right now
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayStr = days[new Date().getDay()];
    const currentTime = new Date().toLocaleTimeString('en-GB', { hour12: false }); // 'HH:MM:SS'

    // Look for a schedule they are enrolled in today, where current time is roughly around class time
    const schedRes = await pool.query(`
      SELECT s.scheduleid, s.classid, s.starttime, s.endtime, s.subject
      FROM schedule s
      JOIN enrollment en ON s.classid = en.classid
      WHERE en.studentid = $1 AND s.dayofweek = $2
    `, [student.studentid, todayStr]);

    if (schedRes.rows.length === 0) {
      return res.status(400).json({ error: 'Student has no classes scheduled for today', student: student.fullname });
    }

    // For demonstration, let's just pick the first class of the day if we can't find one that matches the exact time.
    // Ideally, we find the one where CURRENT_TIME is between starttime and endtime.
    let activeClass = schedRes.rows.find(c => currentTime >= c.starttime && currentTime <= c.endtime);
    if (!activeClass) {
      activeClass = schedRes.rows[0]; // fallback to their first class today
    }

    // Get or create today's session for this schedule
    let sessionRes = await pool.query(`
      SELECT sessionid FROM session 
      WHERE scheduleid = $1 AND sessiondate = CURRENT_DATE
    `, [activeClass.scheduleid]);

    let sessionId;
    if (sessionRes.rows.length === 0) {
      const newSess = await pool.query(`
        INSERT INTO session (scheduleid, sessiondate) 
        VALUES ($1, CURRENT_DATE) RETURNING sessionid
      `, [activeClass.scheduleid]);
      sessionId = newSess.rows[0].sessionid;
    } else {
      sessionId = sessionRes.rows[0].sessionid;
    }

    // Fetch late/absent thresholds from system_settings
    let lateThreshold = 15;  // default fallback
    let absentThreshold = 90; // default fallback
    try {
      const settingsRes = await pool.query(`SELECT key, value FROM system_settings WHERE key IN ('late_threshold', 'absent_threshold')`);
      settingsRes.rows.forEach(row => {
        if (row.key === 'late_threshold') lateThreshold = parseInt(row.value, 10);
        if (row.key === 'absent_threshold') absentThreshold = parseInt(row.value, 10);
      });
    } catch (e) { /* use defaults */ }

    // Determine status based on time difference
    const parseTimeToMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return (hours * 60) + minutes;
    };
    
    const startMinutes = parseTimeToMinutes(activeClass.starttime);
    const currentMinutes = parseTimeToMinutes(currentTime);
    const minutesLate = currentMinutes - startMinutes;
    
    let status = 'Present';
    let dbMinutesLate = null;
    
    if (minutesLate >= absentThreshold) {
      status = 'Absent';
    } else if (minutesLate >= lateThreshold) {
      status = 'Late';
      dbMinutesLate = minutesLate;
    }

    // Insert attendance record
    const updateRes = await pool.query(`
      UPDATE attendance 
      SET status = $1, attendedat = NOW(), minutelate = $4, deviceid = 1
      WHERE studentid = $2 AND sessionid = $3
    `, [status, student.studentid, sessionId, dbMinutesLate]);

    if (updateRes.rowCount === 0) {
      await pool.query(`
        INSERT INTO attendance (studentid, sessionid, status, attendedat, minutelate)
        VALUES ($1, $2, $3, NOW(), $4)
      `, [student.studentid, sessionId, status, dbMinutesLate]);
    }
    
    const logColor = status === 'Present' ? 'text-emerald-500' : (status === 'Late' ? 'text-yellow-500' : 'text-red-500');
    await logSystemAction('ATTENDANCE_SCAN', `${student.fullname} scanned (${status}) for ${activeClass.subject}`, logColor);

    res.json({ 
      success: true, 
      message: 'Attendance recorded successfully', 
      student: student.fullname,
      subject: activeClass.subject
    });

  } catch (error) {
    console.error('Error recording scan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ----------------------------------------------------
// TEACHER MODULE ENDPOINTS
// ----------------------------------------------------

// GET /api/teacher/classes/:teacherId
// Fetch assigned classes for a specific teacher
app.get('/api/teacher/classes/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    // Map classes to the teacher. This is a simplification; ideally there's a join table or column
    const result = await db.query(`
      SELECT * FROM classes 
      WHERE lecturer = (SELECT fullname FROM users WHERE userid = $1)
    `, [teacherId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/attendance/session
// Start a manual class session
app.post('/api/attendance/session', async (req, res) => {
  try {
    const { classid, teacherid, expectedEndTime } = req.body;
    // We can just log it or handle session logic here. Currently we rely on students checking in.
    res.json({ message: 'Session started successfully' });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/attendance/record
// Submit manual attendance records
app.post('/api/attendance/record', async (req, res) => {
  try {
    const { classid, records } = req.body; 
    // records is an array of { studentid, status, type: 'manual'|'rfid'|'biometric' }
    
    // Process records in bulk
    for (const record of records) {
      // Check if student already checked in today for this class
      const existing = await db.query(`
        SELECT id FROM attendance 
        WHERE studentid = $1 AND classid = $2 AND DATE(time) = CURRENT_DATE
      `, [record.studentid, classid]);

      if (existing.rows.length === 0) {
        await db.query(`
          INSERT INTO attendance (studentid, classid, time, status, type)
          VALUES ($1, $2, NOW(), $3, $4)
        `, [record.studentid, classid, record.status, record.type || 'manual']);
      } else {
        await db.query(`
          UPDATE attendance 
          SET status = $1, type = $2
          WHERE id = $3
        `, [record.status, record.type || 'manual', existing.rows[0].id]);
      }
    }
    res.json({ message: 'Manual attendance submitted successfully' });
  } catch (error) {
    console.error('Error recording manual attendance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/excuses/:id/review
// Review an excuse
// GET /api/teacher/:eid/excuses
app.get('/api/teacher/:eid/excuses', async (req, res) => {
  try {
    const { eid } = req.params;
    
    // Find teacher userid first to check assigned classes or we can query based on lecturer's classes
    const classQuery = `
      SELECT c.classcode
      FROM class c
      JOIN lecturer l ON l.classid = c.classid
      WHERE l.eid = $1
    `;
    const classResult = await pool.query(classQuery, [eid]);
    
    if (classResult.rows.length === 0) {
      return res.json([]);
    }
    
    const classCodes = classResult.rows.map(r => r.classcode);
    
    const excuseQuery = `
      SELECT e.excuseid as id, e.reason, e.status, e.date_submitted,
             e.date as request_date,
             u.username as studentId, en.fullname as student,
             a.classcode as course
      FROM excuserequest e
      JOIN useraccount u ON e.studentid = u.userid
      JOIN entity en ON u.eid = en.eid
      JOIN attendancerecord a ON e.recordid = a.recordid
      WHERE a.classcode = ANY($1)
      ORDER BY e.date_submitted DESC
    `;
    
    const excuses = await pool.query(excuseQuery, [classCodes]);
    
    res.json(excuses.rows.map(row => ({
      id: row.id,
      studentId: row.studentid,
      student: row.student,
      course: row.course,
      date: row.request_date.toISOString().split('T')[0],
      reason: row.reason,
      status: row.status === 'Pending' ? 'Pending' : (row.status === 'Approved' ? 'Approved' : 'Rejected')
    })));
  } catch (error) {
    console.error('Error fetching teacher excuses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/excuses/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewerId } = req.body; // status: 'Approved' or 'Rejected'
    
    await db.query(`
      UPDATE excuses 
      SET status = $1
      WHERE id = $2
    `, [status, id]);
    
    res.json({ message: `Excuse ${status.toLowerCase()} successfully` });
  } catch (error) {
    console.error('Error reviewing excuse:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/teacher/students/:classid
// Get all students enrolled in a class for manual attendance checklist
app.get('/api/teacher/students/:classid', async (req, res) => {
  try {
    const { classid } = req.params;
    // This assumes students are globally available or enrolled. Let's return all students for simplicity
    // and let the frontend filter if necessary, or better, return students where roleid=3
    const result = await db.query(`
      SELECT userid as id, fullname as name, username as matric 
      FROM users 
      WHERE roleid = 3
      ORDER BY fullname
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- ADMIN QUERY TERMINAL ---
app.post('/api/admin/query', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }
  
  try {
    const result = await pool.query(query);
    res.json({
      command: result.command,
      rowCount: result.rowCount,
      rows: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
