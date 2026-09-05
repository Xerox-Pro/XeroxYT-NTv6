import fs from 'fs';
const css = fs.readFileSync('src/index.css', 'utf8');

if (!css.includes('.animate-shimmer')) {
  const shimmerCss = `

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite linear;
  background: linear-gradient(to right, #f3f4f6 4%, #e5e7eb 25%, #f3f4f6 36%);
  background-size: 1000px 100%;
}
`;
  fs.appendFileSync('src/index.css', shimmerCss);
}
