import fs from 'fs';
const content = fs.readFileSync('src/components/VideoPlayer.tsx', 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('const channelAvatar = channel.avatar || channel.authorAvatar || (channel.avatar?.[0]?.url);'));
console.log(lines.slice(start - 5, start + 15).join('\n'));
