import fs from 'fs';
const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('app.get("/api/recommendations"'));
const end = lines.findIndex((l, i) => i > start && l.includes('app.get("/api/search"'));
console.log(lines.slice(start, end).join('\n'));
