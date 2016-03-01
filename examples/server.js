'use strict';
const WebSocketServer = require('ws').Server;
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync(process.env.KEY),
  cert: fs.readFileSync(process.env.CERT)
};
const httpsServer = https.createServer(options);
const wss = new WebSocketServer({
  server: httpsServer
});

httpsServer.on('request', (req, res) => {
  res.writeHead(200);
  res.end('hello HTTPS world\n');
});

wss.on('connection', (ws) => {
  console.log('GOT CONNECTION');
  ws.on('message', (data) => {
    console.log('GOT MESSAGE', data);
  });
  ws.on('close', () => {
    console.log('CLOSE');
  });
});

httpsServer.listen(443);
