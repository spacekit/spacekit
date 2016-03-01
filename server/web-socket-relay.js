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

    this.webSocket.on('message', (message) => {
      message = JSON.parse(message);
      let socket = this.sockets.get(message.connectionId);
      if (socket) {
        if (message.type === 'data') {
          socket.write(new Buffer(message.data, 'base64'));
        } else if (message.type === 'close') {
          socket.end();
        }
      }
    });
  }

  addSocket (socket, hostname) {
    let connectionId = uuid.v4();

    this.sockets.set(connectionId, socket);

    let sendMessage = (message) => {
      message.connectionId = connectionId;
      message.hostname = hostname;
      message.ip = socket.localAddress;
      if (this.webSocket.readyState === WebSocket.OPEN) {
        this.webSocket.send(JSON.stringify(message));
      }
    };

    sendMessage({ type: 'open' });

    socket.on('data', (data) => {
      sendMessage({
        type: 'data',
        data: data.toString('base64')
      });
    });

    socket.on('close', () => {
      this.sockets.delete(connectionId);
      sendMessage({ type: 'close' });
    });
  }
}

module.exports = WebSocketRelay;
