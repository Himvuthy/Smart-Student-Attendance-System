const fs = require('fs');
let code = fs.readFileSync('d:/sasProject/Web-main/src/AdminDashboard.jsx', 'utf8');

// Fix broken DELETE method quotes
code = code.replace(/\{ method: \`DELETE' \}\)/g, "{ method: 'DELETE' })");

// Fix broken bulk attendance fetch string
code = code.replace(/fetch\(\`\$\{baseUrl\}\/api\/attendance\/bulk', \{/g, "fetch(`${baseUrl}/api/attendance/bulk`, {");

// Fix remaining relative URLs like `/api/classes...` inside template literals
code = code.replace(/fetch\(\`\/api\//g, "fetch(`${baseUrl}/api/");

fs.writeFileSync('d:/sasProject/Web-main/src/AdminDashboard.jsx', code);
console.log('Fixed quotes properly');
