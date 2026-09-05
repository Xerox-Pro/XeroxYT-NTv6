import fs from 'fs';
const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');
console.log(lines.findIndex(l => l.includes('categoryPool =')));
const finds = [];
lines.forEach((l, i) => { if(l.includes('categoryPool')) finds.push(i); });
console.log(finds);
