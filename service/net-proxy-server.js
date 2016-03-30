'use strict';
const Net = require('net');

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
        socket.write('HTTP/1.1 500 ' + e.toString() + '\r\n\r\n');
        socket.end();
      }
    });
    socket.on('error', (err) => {
      console.log('net proxy socket error', err);
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
