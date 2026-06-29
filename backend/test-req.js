const fetch = require('node-fetch'); // we'll use standard http

// Let's just mock the HTTP request to the local server
const http = require('http');

async function run() {
  const req = http.request('http://localhost:5001/api/leaderboard', { method: 'GET' }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Leaderboard:', data));
  });
  req.on('error', console.error);
  req.end();
}
run();
