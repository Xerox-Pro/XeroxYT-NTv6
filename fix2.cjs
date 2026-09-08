const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace(/res\.setHeader\(\s*"Cache-Control",\s*"s-maxage=3600, stale-while-revalidate=86400",?\s*\);\s*res\.json/g, 'res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");\n    return res.json');
fs.writeFileSync('server.ts', content);
