import os

filepath = 'd:/sasProject/Web-main/src/AdminDashboard.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

import_end = code.find('\nconst AdminDashboard =')
api_base_def = '\nconst API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";\nconst baseUrl = API_BASE.replace(/\\/$/, "");\n'
code = code[:import_end] + api_base_def + code[import_end:]

code = code.replace("'http://localhost:3000", "`${baseUrl}")
code = code.replace("http://localhost:3000'", "${baseUrl}`")
code = code.replace('"http://localhost:3000', '`${baseUrl}')
code = code.replace('http://localhost:3000"', '${baseUrl}`')
code = code.replace('`http://localhost:3000', '`${baseUrl}')
code = code.replace('const baseUrl = API_BASE.replace(/\\/$/, "");', '')
# put one declaration back
code = code.replace('const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";\n', 'const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";\nconst baseUrl = API_BASE.replace(/\\/$/, "");\n', 1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Done")
