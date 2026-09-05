import fs from 'fs';
const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('// 履歴から動的に大量のパーソナライズクエリを生成'));
const end = lines.findIndex(l => l.includes('// フォールバック: デフォルト検索'));
console.log(start, end);
