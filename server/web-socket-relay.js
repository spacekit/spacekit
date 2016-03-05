'use strict';

const uuid = require('node-uuid');
const WebSocket = require('ws');

/**
 * A relay that tunnels multiple sockets into one WebSocket.
 * This is the server-side protocol of the relay that runs
 * on the client machine.
 *
 * Raw TCP streams are forwarded into the webSocket using
 * custom JSON messages like 'open', 'data', and 'close'.
 */
class WebSocketRelay {

  constructor (webSocket) {
    this.webSocket = webSocket;
    this.sockets = new Map();

    this.webSocket.on('close', () => {
      this.sockets.forEach((socket) => {
        socket.end();
      });
    });

    let currentMessageHeader = null;
    this.webSocket.on('message', (data) => {
      if (!currentMessageHeader) {
        currentMessageHeader = JSON.parse(data);
      } else {
        this.handleRelayMessage(currentMessageHeader, data);
        currentMessageHeader = null;
      }
    });
  }

  handleRelayMessage (header, data) {
    let socket = this.sockets.get(header.connectionId);
    if (!socket) {
      return;
    }

    switch (header.type) {
      case 'data':
        socket.write(data);
        break;
      case 'close':
        socket.end();
        break;
    }
  }

  sendMessage (header, body) {
    if (this.webSocket.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify(header));
      this.webSocket.send(body || new Buffer(0));
    }
  }

  addSocket (socket, hostname, port) {
    let connectionId = uuid.v4();

    this.sockets.set(connectionId, socket);

    this.sendMessage({
      connectionId: connectionId,
      type: 'open',
      hostname: hostname,
      port: port || 443
    }, null);

    socket.on('data', (data) => {
      this.sendMessage({
        connectionId: connectionId,
        type: 'data'
      }, data);
    });

    socket.on('close', () => {
      this.sockets.delete(connectionId);
      this.sendMessage({
        connectionId: connectionId,
        type: 'close'
      }, null);
    });
  }
}

module.exports = WebSocketRelay;
