const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace(/return res\.setHeader\("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400"\);\s*res\.json\(\{/g, 'res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");\n    return res.json({');
fs.writeFileSync('server.ts', content);
