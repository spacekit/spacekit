'use strict';
const Backoff = require('backoff');
const Https = require('https');
const Net = require('net');
const WebSocket = require('ws');

const CreateLogger = require('./create-logger');

const log = CreateLogger('SpaceKitRelay');

/**
 * A SpaceKitRelay either proxies data between the SpaceKitService and local
 * servers or is pings the service every minute for dynamic DNS to stay
 * updated.
 */
class SpaceKitRelay {
  constructor (config) {
    this.config = config;

    if (config.noProxy) {
      this.initPing();
    } else {
      this.initProxy();
    }
  }

  initPing () {
    this.pingRequest = {
      protocol: 'https:',
      host: `${this.config.service}.${this.config.host}`,
      port: 443,
      path: '/ping',
      headers: {
        'x-spacekit-subdomain': this.config.relay,
        'x-spacekit-username': this.config.username,
        'x-spacekit-apikey': this.config.apiKey
      }
    };

    this.pingInterval = setInterval(this.pingService.bind(this), 60000);

    this.pingService();
  }

  pingService () {
    Https.get(this.pingRequest, (res) => {
      log.info(`ping response (${res.statusCode})`);
      res.resume();
    }).on('error', (err) => {
      log.error(err, 'ping request error');
    });
  }

  initProxy () {
    this.proxyUrl = `wss://${this.config.service}.${this.config.host}/`;
    this.hostname = `${this.config.relay}.${this.config.username}.${this.config.host}`;
    this.outgoingSockets = new Map();

    this.backoff = Backoff.fibonacci({
      randomisationFactor: 0.4,
      initialDelay: 1000,
      maxDelay: 5 * 60000
    });

    this.backoff.on('backoff', (number, delay) => {
      log.info(`proxy reconnecting in ${delay}ms`);
    });

    this.backoff.on('ready', this.connectProxy.bind(this));

    this.connectProxy();
  }

  connectProxy () {
    log.info(`proxy connecting to ${this.proxyUrl}`);

    this.ws = new WebSocket(this.proxyUrl, 'spacekit', {
      headers: {
        'x-spacekit-subdomain': this.config.relay,
        'x-spacekit-username': this.config.username,
        'x-spacekit-apikey': this.config.apiKey
      }
    });

    this.ws.on('open', () => {
      log.info(`proxy connected as ${this.hostname}`);
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
      log.info('proxy lost connection to service');
      this.backoff.backoff();
    });

    this.ws.on('error', (err) => {
      log.error(err, 'proxy web socket error event');
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
