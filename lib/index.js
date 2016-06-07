'use strict';
const Backoff = require('backoff');
const CreateLogger = require('./create-logger');
const EventEmitter = require('events');
const Net = require('net');
const TlsCertificate = require('./tls-certificate');
const TlsTerminatingSocket = require('./tls-terminating-socket');
const WebSocket = require('ws');

const log = CreateLogger('Relay');

/**
 * A Relay securely proxies socket connections between the
 * SpaceKit service and a server running within your local network.
 */
class Relay extends EventEmitter {
  constructor (config) {
    super();

    this.config = config;

    this.proxyUrl = `wss://${this.config.service}.${this.config.host}/`;
    this.hostname = `${this.config.relay}.${this.config.username}.${this.config.host}`;
    this.outgoingSockets = new Map();

    this.backoff = Backoff.fibonacci({
      randomisationFactor: 0.4,
      initialDelay: 1000,
      maxDelay: 5 * 60000
    });
    this.backoff.on('backoff', (number, delay) => {
      log.debug(`Reconnecting in ${delay}ms...`);
    });
    this.backoff.on('ready', this.connect.bind(this));

    this.connect();
  }

  close () {
    log.debug('closing stuff!');

    this.ws.close();
    this.backoff.reset();
    this.destroyed = true;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }

  maybeReconnect () {
    if (!this.destroyed) {
      this.backoff.backoff();
    }
  }

  connect () {
    log.info(`Relay connecting to ${this.proxyUrl}...`);

    this.ws = new WebSocket(this.proxyUrl, 'spacekit', {
      headers: {
        'x-spacekit-subdomain': this.config.relay,
        'x-spacekit-username': this.config.username,
        'x-spacekit-apikey': this.config.apiKey
      }
    });

    this.ws.on('open', () => {
      log.info(`Connected as ${this.hostname}.`);

      this.backoff.reset();

      this.certificate = new TlsCertificate(this.hostname);
      // Asynchronously try to get the certificate right away.
      this.certificate.ensureValidCertificate()
        .then(() => {
          this.emit('connected');
          console.log(`Ready! This relay is securely accessible at \x1b[32;1m${this.hostname}\x1b[0m:\n`);
          this.config.portMap.mapping.forEach((value, key) => {
            let sourcePortString = value.sourcePort === 443 ? '' : ':' + value.sourcePort;
            console.log(`    https://${this.hostname}${sourcePortString}/ => ${value.hostname}:${value.destinationPort}`);
          });
        });

      if (this.pingInterval) {
        clearInterval(this.pingInterval);
      }
      this.pingInterval = setInterval(this.pingService.bind(this), 60000);
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
      log.warn('Lost connection to the service.');
      console.log('Connection to the SpaceKit server failed. Reconnecting...');
      this.maybeReconnect();
    });

    this.ws.on('error', (err) => {
      log.error(err, 'Service connection encountered an error.');
      // Note: We don't need to reconnect here. We will always receive
      // a "close" event, even if we never successfully connected.
    });
  }

  pingService () {
    log.debug('pinging');
    this.sendMessage('ping');
  }

  sendMessage (header, body) {
    if (this.ws.readyState === WebSocket.OPEN) {
      let _data = { header: header, bodyLength: body && body.length };
      log.trace(_data, 'send message');

      this.ws.send(JSON.stringify(header));
      this.ws.send(body || new Buffer(0));
    }
  }

  respondToAcmeChallengeConnection (id) {
    this.sendMessage({
      connectionId: id,
      type: 'data'
    }, 'HTTP/1.0 200 OK\r\n\r\n' + this.certificate.challengeValue);
    this.sendMessage({
      connectionId: id,
      type: 'close'
    }, null);
  }

  openSecureConnection (id, port) {
    this.certificate.ensureValidCertificate().then((secureContext) => {
      let portInfo = this.config.portMap.get(port);

      if (!portInfo) {
        log.error(`no port mapping for ${port}`);
        throw new Error('no port mapping'); // closes cleanly below
      }

      log.info(`Attempting to establish a connection to ${portInfo.hostname}:${portInfo.destinationPort}`);

      // TODO: what if portInfo.hostname is equal to this.hostname? will that cause things to blow up?
      return new TlsTerminatingSocket(Net.connect(portInfo.destinationPort, portInfo.hostname), secureContext);
    }).then((socket) => {
      this.outgoingSockets.set(id, socket);

      socket.on('data', (data) => {
        this.sendMessage({ connectionId: id, type: 'data' }, data);
      });

      socket.on('close', (e) => {
        this.sendMessage({ connectionId: id, type: 'close' }, null);
      });

      socket.on('error', (err) => {
        log.error({ err: err }, 'endpoint socket error event');
        this.sendMessage({ connectionId: id, type: 'close' }, null);
      });
    }).catch((err) => {
      if (err) {
        log.error({ err: err }, 'failed to open secure connection');
      }
      this.sendMessage({ connectionId: id, type: 'close' }, null);
    });
  }

  handleMessage (header, body) {
    let id = header.connectionId;

    if (header.type === 'open') {
      if (header.port === 80) {
        this.respondToAcmeChallengeConnection(id);
      } else {
        this.openSecureConnection(id, header.port);
      }
    } else if (header.type === 'data') {
      let socket = this.outgoingSockets.get(id);
      if (socket) {
        socket.write(body);
      }
    } else if (header.type === 'close') {
      let socket = this.outgoingSockets.get(id);
      if (socket) {
        socket.end();
        this.outgoingSockets.delete(header.connectionId);
      }
    }
  }
}

module.exports = Relay;
