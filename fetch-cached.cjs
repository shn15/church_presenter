const http = require('http');
const fs = require('fs');

http.get('http://localhost:3000/src/components/Operator/Dashboard.tsx', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('SUCCESS! Source code retrieved via local dev server. Length:', data.length);
      fs.writeFileSync('./Dashboard_cached.tsx', data);
      console.log('Saved to ./Dashboard_cached.tsx');
    } else {
      console.log('Failed to fetch from dev server. Status:', res.statusCode, 'Data preview:', data.substring(0, 200));
    }
  });
}).on('error', (err) => {
  console.log('Error reaching local dev server:', err.message);
});
