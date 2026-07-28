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
      SELECT e.eid, e.fullname, u.email, e.phonenumber, s.studentid, b.biometricid
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

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- ENTITY CRUD APIS ---

app.get('/api/entities', async (req, res) => {
  try {
    const query = `
      SELECT e.eid, u.userid, u.username, r.rolename, e.fullname, e.gender, e.dateofbirth, 
e.phonenumber, u.email, e.roleid, s.studentid, l.lecturerid
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
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting entity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- NEW APIS for Class -> Schedule -> Attendance ---

app.get('/api/classes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.classid, c.classname, c.classcode, 
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

app.get('/api/classes/:classid/schedules', async (req, res) => {
  try {
    const { classid } = req.params;
    const result = await pool.query(
      'SELECT scheduleid, subject, starttime, endtime, dayofweek FROM schedule WHERE classid = $1',
      [classid]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedules:', error);
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
      SELECT s.studentid, ent.fullname, ent.profilepicture, ent.email 
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
    const { updates } = req.body; 
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const update of updates) {
        const { rowCount } = await client.query(
          'UPDATE attendance SET status = $1, attendedat = CURRENT_TIMESTAMP WHERE studentid = $2 AND sessionid = $3',
          [update.status, update.studentid, update.sessionid]
        );
        if (rowCount === 0) {
          await client.query(
            'INSERT INTO attendance (studentid, sessionid, status, attendedat) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
            [update.studentid, update.sessionid, update.status]
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

app.get('/api/attendance-tracking/classes', async (req, res) => {
  try {
    const classResult = await pool.query(`
      SELECT c.classid, c.classname, c.classcode, 
        (SELECT COUNT(*) FROM enrollment e WHERE e.classid = c.classid) AS total_enrolled
      FROM class c
    `);
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayStr = days[new Date().getDay()];
    
    const enhancedClasses = await Promise.all(classResult.rows.map(async (cls) => {
      let todaySubject = null;
      let presentCount = 0;
      
      const scheduleRes = await pool.query('SELECT scheduleid, subject FROM schedule WHERE classid = $1 AND dayofweek = $2', [cls.classid, todayStr]);
      if (scheduleRes.rows.length > 0) {
        todaySubject = scheduleRes.rows[0].subject;
        const sessionRes = await pool.query('SELECT sessionid FROM session WHERE scheduleid = $1 AND sessiondate = CURRENT_DATE', [scheduleRes.rows[0].scheduleid]);
        if (sessionRes.rows.length > 0) {
          const attRes = await pool.query("SELECT COUNT(*) FROM attendance WHERE sessionid = $1 AND status != '-' AND status != 'Absent'", [sessionRes.rows[0].sessionid]);
          presentCount = parseInt(attRes.rows[0].count);
        }
      }
      
      return {
        ...cls,
        todaySubject,
        presentCount
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
