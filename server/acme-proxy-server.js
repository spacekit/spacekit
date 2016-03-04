'use strict';

const net = require('net');

const ACME_PREFIX = 'GET /.well-known/acme-challenge/';

function parseAcmeFromHeader (head) {
  if (!head.startsWith(ACME_PREFIX.slice(0, head.length))) {
    throw new Error('only ACME requests supported');
  }
  let hostMatch = /^Host:\s*(.*?)\r\n/im.exec(head);
  if (hostMatch) {
    return hostMatch[1];
  } else if (head.length > 8 * 1024) {
    throw new Error('header too long');
  } else if (head.indexOf('\r\n\r\n') !== -1) {
    throw new Error('no hostname provided');
  } else {
    return null;
  }
}

function createAcmeProxyServer (connectionHandler) {
  return net.createServer((socket) => {
    let head = '';
    socket.on('data', (data) => {
      head = head + data.toString('ascii');
      try {
        let hostname = parseAcmeFromHeader(head);
        if (hostname) {
          socket.removeAllListeners('data');
          socket.pause();
          socket.unshift(new Buffer(head, 'ascii'));
          connectionHandler(socket, hostname);
          socket.resume();
        } else {
          // Waiting for more data.
        }
      } catch (e) {
        socket.write('HTTP/1.1 400 ' + e.toString() + '\r\n\r\n');
        socket.end();
      }
    });
  });
}

module.exports = createAcmeProxyServer;
