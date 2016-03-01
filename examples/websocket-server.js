'use strict';
const WebSocketServer = require('ws').Server;

const wss = new WebSocketServer({ port: process.env.PORT });

wss.on('connection', (ws) => {
  console.log('GOT CONNECTION');
  ws.on('message', (data) => {
    console.log('GOT MESSAGE', data);
  });
  ws.on('close', () => {
    console.log('CLOSE');
  });
});
