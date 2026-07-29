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
      let lateCount = 0;
      
      const scheduleRes = await pool.query('SELECT scheduleid, subject FROM schedule WHERE classid = $1 AND dayofweek = $2', [cls.classid, todayStr]);
      if (scheduleRes.rows.length > 0) {
        todaySubject = scheduleRes.rows[0].subject;
        const sessionRes = await pool.query('SELECT sessionid FROM session WHERE scheduleid = $1 AND sessiondate = CURRENT_DATE', [scheduleRes.rows[0].scheduleid]);
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
