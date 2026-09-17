const fs = require('fs');
let code = fs.readFileSync('src/components/SearchChannelCard.tsx', 'utf8');

code = code.replace(
  /<img/g,
  `<img crossOrigin="anonymous"`
);

fs.writeFileSync('src/components/SearchChannelCard.tsx', code);
