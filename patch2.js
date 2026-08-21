const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'backend/src/worker.ts');
let code = fs.readFileSync(p, 'utf8');

// Fix typo in Vercel URL
code = code.replace(
  /'https:\/\/reach-inbox-pied\.vercel\.app\/api\/relay'/g,
  "'https://reach-in-box-pied.vercel.app/api/relay'"
);

fs.writeFileSync(p, code);
