const fs = require('fs');
let code = fs.readFileSync('src/components/VideoCard.tsx', 'utf8');

code = code.replace(
  /<img/g,
  `<img crossOrigin="anonymous"`
);

fs.writeFileSync('src/components/VideoCard.tsx', code);
