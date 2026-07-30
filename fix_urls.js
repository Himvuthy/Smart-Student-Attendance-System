const fs = require('fs');
let code = fs.readFileSync('d:/sasProject/Web-main/src/AdminDashboard.jsx', 'utf8');

code = code.replace(/\`\$\{baseUrl\}([^']*?)'/g, '\`${baseUrl}$1\`');
code = code.replace(/\`\$\{baseUrl\}([^"]*?)"/g, '\`${baseUrl}$1\`');
code = code.replace(/['"]http:\/\/localhost:3000([^'"]*)['"]/g, '\`${baseUrl}$1\`');

// Let's also fix the ones from lines 737, 759, 787 that were like fetch(`/api/...`) but should be `${baseUrl}/api/...`
code = code.replace(/fetch\(['"]\/api\//g, 'fetch(`${baseUrl}/api/');

fs.writeFileSync('d:/sasProject/Web-main/src/AdminDashboard.jsx', code);
console.log('Fixed quotes');
