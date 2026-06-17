
const fs = require('fs');
let content = fs.readFileSync('src/components/DailyDetail.tsx', 'utf8');
content = content.split('\\n').join('\n');
fs.writeFileSync('src/components/DailyDetail.tsx', content);
