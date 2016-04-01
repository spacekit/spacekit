'use strict';
const Net = require('net');

const CreateLogger = require('../create-logger');

const log = CreateLogger('CreateNetProxyServer');

/**
 * Create a server that extracts the hostname and path from incoming Net
 * connections, puts the data back on the socket, and hands you back the socket
 * and hostname.
 *
 * @param {function(socket, hostname, path)} connectionHandler
 * @return {Net.Server}
 */
function createNetProxyServer (connectionHandler) {
  return Net.createServer((socket) => {
    socket.on('error', (err) => {
      log.error(err, 'proxied socket error');
    });

    let head = '';

    socket.on('data', (data) => {
      head = head + data.toString('ascii');

      try {
        let hostname = parseHostFromHeader(head);

        if (hostname) {
          let path = parsePathFromHeader(head);
          socket.removeAllListeners('data');
          socket.pause();
          socket.unshift(new Buffer(head, 'ascii'));
          connectionHandler(socket, hostname, path);
          socket.resume();
        } else {
          // Waiting for more data.
        }
      } catch (e) {
        let message = 'Parsing exception';
        socket.end(`HTTP/1.1 500 ${message}\r\n\r\n${message}`);
      }
    });
  });
}

function parsePathFromHeader (head) {
  let pathMatch = /^[A-Za-z]+\s+(.*?)\s/.exec(head);

  if (pathMatch) {
    return pathMatch[1];
  } else if (head.length > 8 * 1024) {
    throw new Error('header too long');
  } else {
    return '';
  }
}

function parseHostFromHeader (head) {
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

module.exports = createNetProxyServer;
