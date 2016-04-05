'use strict';
const Backoff = require('backoff');
const Net = require('net');
const WebSocket = require('ws');

const CreateLogger = require('./create-logger');
const TlsCertificateGenerator = require('./tls-certificate-generator');
const TlsTerminatingSocket = require('./tls-terminating-socket');

const log = CreateLogger('Relay');

/**
 * A Relay securely proxies socket connections between the
 * SpaceKit service and a server running within your local network.
 */
class Relay {

  constructor (config) {
    this.config = config;

    this.proxyUrl = `wss://${this.config.service}.${this.config.host}/`;
    this.hostname = `${this.config.relay}.${this.config.username}.${this.config.host}`;
    this.outgoingSockets = new Map();

    if (!this.config.portMap.size) {
      log.error('You must specify at least one port mapping, e.g. "-p 8000"');
      process.exit(1);
    }

    this.tlsCertificateGenerator = new TlsCertificateGenerator();

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
      this.tlsCertificateGenerator.generateCertificate(this.hostname);
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
      this.backoff.backoff();
    });

    this.ws.on('error', (err) => {
      log.error(err, 'Service connection encountered an error.');
      this.backoff.backoff();
    });
  }

  sendMessage (header, body) {
    if (this.ws.readyState === WebSocket.OPEN) {
      let _data = { header: header, bodyLength: body && body.length };
      log.trace(_data, 'send message');

      this.ws.send(JSON.stringify(header));
      this.ws.send(body || new Buffer(0));
    }
  }

  handleMessage (header, body) {
    let id = header.connectionId;
    let socket = this.outgoingSockets.get(id);

    switch (header.type) {
      case 'open':
        if (this.tlsCertificateGenerator.hasValidCertificate()) {
          // TODO: spacekit server should return 443, not 80
          if (header.port === 80) {
            header.port = 443;
          }
          let portInfo = this.config.portMap.get(header.port);
          if (!portInfo) {
            log.error(`no port mapping for ${header.port}`);
            this.sendMessage({
              connectionId: id,
              type: 'close'
            }, null);
            break;
          }
          log.info(`Attempting to establish a connection to ${portInfo.hostname}:${portInfo.destinationPort}`);
          // TODO: what if portInfo.hostname is equal to this.hostname? will that cause things to blow up?
          socket = new TlsTerminatingSocket(
            Net.connect(portInfo.destinationPort, portInfo.hostname),
            this.tlsCertificateGenerator.createSecureContext());
        } else {
          // TODO: The SpaceKit server should explicitly state that this
          // connection is an ACME verification request, rather than us
          // inferring it from coming in on port 80. (The server has already
          // inspected the HTTP header to know this.)
          if (header.port === 80) {
            socket = Net.connect(this.tlsCertificateGenerator.acmePort);
          } else {
            log.error(`cannot establish connection; we don't have a valid certificate yet`);
            this.sendMessage({
              connectionId: id,
              type: 'close'
            }, null);
            break;
          }
        }
        this.outgoingSockets.set(id, socket);
        socket.on('data', (data) => {
          this.sendMessage({
            connectionId: id,
            type: 'data'
          }, data);
        });

        socket.on('close', (e) => {
          this.sendMessage({
            connectionId: id,
            type: 'close'
          }, null);
        });

        socket.on('error', (err) => {
          log.error({ err: err }, 'endpoint socket error event');

          this.sendMessage({
            connectionId: id,
            type: 'close'
          }, null);
        });
        break;
      case 'data':
        if (!socket) {
          break;
        }
        socket.write(body);
        break;
      case 'close':
        if (!socket) {
          break;
        }
        socket.end();
        this.outgoingSockets.delete(header.connectionId);
        break;
    }
  }
}

module.exports = Relay;
