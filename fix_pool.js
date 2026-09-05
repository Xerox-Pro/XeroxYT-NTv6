import fs from 'fs';
const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');
const firstPoolStart = lines.findIndex(l => l.includes('// 多彩な一般ジャンルプール（ベース）'));
const secondPoolStart = lines.findIndex((l, i) => i > firstPoolStart && l.includes('// 一般ジャンルプール'));

if (firstPoolStart !== -1 && secondPoolStart !== -1) {
  lines.splice(firstPoolStart, secondPoolStart - firstPoolStart);
  fs.writeFileSync('server.ts', lines.join('\n'));
}
