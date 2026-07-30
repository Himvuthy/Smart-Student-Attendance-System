const fs = require('fs');

const file = 'd:/sasProject/Web-main/src/AdminDashboard.jsx';
let code = fs.readFileSync(file, 'utf8');
let count = 0;

// Fix: `some string" => "some string"
// Fix: `some string' => 'some string'
// Fix: "some string` => "some string"  (shouldn't happen but just in case)
// Only match strings with NO interpolation (no ${...}) and no newlines
code = code.replace(/`([^`\n${}]*?)["']/g, (match, inner) => {
  // Determine the closing quote
  const closingQuote = match[match.length - 1];
  count++;
  return `'${inner}'`;
});

// Also fix method: `PUT' / `POST' / `DELETE' / `GET' patterns
code = code.replace(/method:\s*`(GET|POST|PUT|DELETE|PATCH)'/g, (match, method) => {
  count++;
  return `method: '${method}'`;
});

// Fix window.prompt/confirm with backtick opening
code = code.replace(/window\.(prompt|confirm|alert)\(`([^`\n${}]*?)["']/g, (match, fn, inner) => {
  count++;
  return `window.${fn}("${inner}"`;
});

// Fix setTrackingLevel(`value') and similar single arg string calls
code = code.replace(/\(`([a-zA-Z0-9_\- ]+?)['"](\))/g, (match, inner, close) => {
  count++;
  return `('${inner}')`;
});

// Fix console.error/log(`string" patterns
code = code.replace(/console\.(error|log|warn)\(`([^`\n${}]*?)["']/g, (match, fn, inner) => {
  count++;
  return `console.${fn}("${inner}"`;
});

fs.writeFileSync(file, code);
console.log(`Fixed ${count} mismatched quote(s) in AdminDashboard.jsx`);
