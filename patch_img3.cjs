const fs = require('fs');
let code = fs.readFileSync('src/components/Avatar.tsx', 'utf8');

code = code.replace(
  /<img/g,
  `<img crossOrigin="anonymous"`
);

fs.writeFileSync('src/components/Avatar.tsx', code);
