const fs = require('fs');

const file = 'd:/sasProject/Web-main/src/AdminDashboard.jsx';
const code = fs.readFileSync(file, 'utf8');
const lines = code.split('\n');

let found = [];
lines.forEach((line, i) => {
  // Skip lines with template literals that have ${} (valid template strings)
  // Look for backtick followed by non-interpolated content then a different quote type
  const stripped = line.replace(/`[^`]*\${[^}]*}[^`]*`/g, ''); // remove valid templates
  const suspicious = stripped.match(/`[^`\n]{0,100}["']/);
  if (suspicious) {
    found.push(`Line ${i+1}: ${line.trim()}`);
  }
});

if (found.length === 0) {
  console.log('✅ No mismatched quotes found!');
} else {
  console.log(`⚠️  Found ${found.length} suspicious line(s):`);
  found.forEach(l => console.log(l));
}
