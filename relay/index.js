'use strict';
const Backoff = require('backoff');
const Net = require('net');
const WebSocket = require('ws');

const CreateLogger = require('../create-logger');

const log = CreateLogger('SpaceKitRelay');

/**
 * A SpaceKitRelay proxies data between a SpaceKitServer and local servers.
 * Only TLS traffic is proxied; each app server must serve its own certificate.
 * (The SpaceKitServer does allow ACME (LetsEncrypt) traffic through.)
 *
 *     [SpaceKitServer] <------ws-------- [SpaceKitRelay]
 *             |            internet          /   \
 *             |                             /     \
 *          client                       tls-app  tls-app
 */
class SpaceKitRelay {
  constructor (config) {
    this.config = config;
    this.url = `wss://${config.service}.${config.host}/`;
    this.hostname = `${config.relay}.${config.username}.${config.host}`;

    this.outgoingSockets = new Map();

    this.backoff = Backoff.fibonacci({
      randomisationFactor: 0.4,
      initialDelay: 1000,
      maxDelay: 5 * 60000
    });
    this.backoff.on('backoff', (number, delay) => {
      log.info(`Reconnecting in ${delay}ms.`);
    });
    this.backoff.on('ready', this.connect.bind(this));

    this.connect();
  }

  connect () {
    log.info(`Connecting to ${this.url}`);

    this.ws = new WebSocket(this.url, 'spacekit', {
      headers: {
        'x-spacekit-subdomain': this.config.relay,
        'x-spacekit-username': this.config.username,
        'x-spacekit-apikey': this.config.apiKey
      }
    });

    this.ws.on('open', () => {
      log.info(`Connected to service as ${this.hostname}`);
      this.backoff.reset();
    });

    let currentMessageHeader = null;

    this.ws.on('message', (data) => {
      if (!currentMessageHeader) {
        currentMessageHeader = JSON.parse(data);
      } else {
        this.handleMessage(currentMessageHeader, data);
        currentMessageHeader = null;
      }
    });

    this.ws.on('close', () => {
      log.info('Lost connection to server.');
      this.backoff.backoff();
    });

    this.ws.on('error', (err) => {
      log.error(err, 'error event');
      this.backoff.backoff();
    });
  }

  sendMessage (header, body) {
    if (this.ws.readyState === WebSocket.OPEN) {
      let _data = { header: header, bodyLength: body && body.length };
      log.info(_data, 'send message');

      this.ws.send(JSON.stringify(header));
      this.ws.send(body || new Buffer(0));
    }
  }

  handleMessage (header, body) {
    let id = header.connectionId;
    let socket = this.outgoingSockets.get(id);

    let _data = { header: header, bodyLength: body && body.length };
    log.info(_data, 'handle message');

    if (header.type === 'open') {
      socket = Net.connect(header.port);

      this.outgoingSockets.set(id, socket);

      socket.on('data', (data) => {
        this.sendMessage({
          connectionId: id,
          type: 'data'
        }, data);
      });
      socket.on('close', () => {
        this.sendMessage({
          connectionId: id,
          type: 'close'
        }, null);
      });
      socket.on('error', (err) => {
        let _data = { err: err, header: header };
        log.error(_data, 'outgoing socket error event');

        this.sendMessage({
          connectionId: id,
          type: 'close'
        }, null);
      });
    } else if (header.type === 'data') {
      socket.write(body);
    } else if (header.type === 'close') {
      socket.end();
      this.outgoingSockets.delete(id);
    }
  }
}

module.exports = SpaceKitRelay;
