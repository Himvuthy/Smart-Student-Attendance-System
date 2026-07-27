const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.dusubxmflzjyshtfoxmd:SmartATTSystem123@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres'
});

const generateAttendance = (studentId, sessionId) => {
  const rand = Math.random();
  let status = 'Present';
  let minuteLate = null;

  // 60% present, 26% late, 14% absent
  if (rand < 0.14) {
    status = 'Absent';
  } else if (rand < 0.40) {
    status = 'Late';
    minuteLate = Math.floor(Math.random() * 45) + 1; // 1 to 45 mins late
  }

  return { studentId, sessionId, status, minuteLate };
};

const getNextDayOfWeek = (startDate, dayOfWeekStr) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDay = days.indexOf(dayOfWeekStr);
  const resultDate = new Date(startDate.getTime());
  resultDate.setDate(startDate.getDate() + ((targetDay + 7 - startDate.getDay()) % 7));
  return resultDate;
};

const run = async () => {
  try {
    await client.connect();

    // 1. Get students for class 2
    const { rows: students } = await client.query('SELECT s.studentid FROM student s JOIN enrollment e ON s.studentid = e.studentid WHERE e.classid = 2');
    console.log(`Found ${students.length} students in class 2`);

    // 2. Get schedules for class 2
    const { rows: schedules } = await client.query('SELECT scheduleid, dayofweek FROM schedule WHERE classid = 2');
    console.log(`Found ${schedules.length} schedules in class 2`);

    // 3. Clear existing sessions & attendance for this class
    const scheduleIds = schedules.map(s => s.scheduleid);
    if (scheduleIds.length > 0) {
      await client.query('DELETE FROM attendance WHERE sessionid IN (SELECT sessionid FROM session WHERE scheduleid = ANY($1::int[]))', [scheduleIds]);
      await client.query('DELETE FROM session WHERE scheduleid = ANY($1::int[])', [scheduleIds]);
      console.log('Cleared existing sessions and attendance');
    }

    // 4. Generate 15 weeks of sessions starting from Jan 1, 2026
    const semesterStart = new Date('2026-01-01T00:00:00Z');
    let sessionCount = 0;
    
    const attendanceValues = [];
    const attendanceParams = [];

    for (const schedule of schedules) {
      let currentWeekDate = getNextDayOfWeek(semesterStart, schedule.dayofweek);
      
      for (let week = 0; week < 15; week++) {
        // Insert session
        const sessionDate = currentWeekDate.toISOString().split('T')[0];
        const res = await client.query(
          'INSERT INTO session (scheduleid, sessiondate) VALUES ($1, $2) RETURNING sessionid',
          [schedule.scheduleid, sessionDate]
        );
        const sessionId = res.rows[0].sessionid;
        sessionCount++;

        // Batch attendance for all students
        for (const student of students) {
          const { status, minuteLate } = generateAttendance(student.studentid, sessionId);
          const attendedAt = `${sessionDate} 08:00:00`;
          
          attendanceValues.push(1); // placeholder
          attendanceParams.push(student.studentid, sessionId, status, minuteLate, attendedAt);
        }

        // Move to next week
        currentWeekDate.setDate(currentWeekDate.getDate() + 7);
      }
    }

    // Run batch insert
    console.log(`Batch inserting ${attendanceValues.length} attendance records...`);
    const chunkSize = 500; 
    for (let i = 0; i < attendanceValues.length; i += chunkSize) {
      const chunkParams = attendanceParams.slice(i * 5, (i + chunkSize) * 5);
      
      // Remap parameter indices for chunk
      let chunkQueryValues = [];
      let cIdx = 1;
      for (let j = 0; j < chunkParams.length / 5; j++) {
        chunkQueryValues.push(`($${cIdx}, $${cIdx+1}, $${cIdx+2}, $${cIdx+3}, $${cIdx+4})`);
        cIdx += 5;
      }
      
      const query = `INSERT INTO attendance (studentid, sessionid, status, minutelate, attendedat) VALUES ${chunkQueryValues.join(', ')}`;
      await client.query(query, chunkParams);
    }

    console.log(`Successfully inserted ${sessionCount} sessions and ${attendanceValues.length} attendance records.`);

  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await client.end();
  }
};

run();
