const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync(process.env.KEY),
  cert: fs.readFileSync(process.env.CERT)
};

https.createServer(options, function (req, res) {
  res.writeHead(200);
  res.end('hello HTTPS world\n');
}).listen(443, '0.0.0.0', () => {
  console.log(`Server running.`);
});
