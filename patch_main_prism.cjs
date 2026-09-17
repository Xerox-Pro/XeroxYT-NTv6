const fs = require('fs');
let code = fs.readFileSync('src/MainApp.tsx', 'utf8');

code = code.replace(
  /blurAmount: 0\.2, refraction: 1\.4, chromAberration: 0\.5, cornerRadius: 0, zRadius: 20/g,
  `blurAmount: 0.3, refraction: 1.6, chromAberration: 0.9, cornerRadius: 0, zRadius: 30`
);

fs.writeFileSync('src/MainApp.tsx', code);
