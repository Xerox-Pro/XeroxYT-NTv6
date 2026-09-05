import fs from 'fs';
const content = fs.readFileSync('src/components/VideoPlayer.tsx', 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('{/* チャンネル情報 */}'));
const end = lines.findIndex((l, i) => i > start && l.includes('{/* アクションボタン */}'));
console.log(lines.slice(start, end).join('\n'));
