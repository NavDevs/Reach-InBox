const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'backend/src/worker.ts');
let code = fs.readFileSync(p, 'utf8');

// Replace nodemailer transport with axios call
code = code.replace(
  /const info = await transporter\.sendMail\(\{[^]*?\}\);/g,
  `const payload = {
      to,
      subject: email.subject,
      text: email.body,
    };
    
    // Bypass Render SMTP firewall by relaying through Vercel!
    const axios = require('axios');
    const relayResponse = await axios.post('https://reach-inbox-pied.vercel.app/api/relay', payload);
    const info = { messageId: relayResponse.data.messageId };`
);

fs.writeFileSync(p, code);
