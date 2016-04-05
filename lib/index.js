'use strict';
const Backoff = require('backoff');
const EventEmitter = require('events');
const Http = require('http');
const Https = require('https');
const LetsEncrypt = require('letsencrypt');
const Net = require('net');
const Tls = require('tls');
const WebSocket = require('ws');

const CreateLogger = require('./create-logger');

const log = CreateLogger('SpaceKitRelay');

class TransparentTlsSocket {
  constructor(socket, pems) {
    this.socketOut = socket;
    this.fakeIncomingSocket = new require('stream').Duplex({
      read(n) {

      },
      write(chunk, encoding, next) {
        //socket.write(chunk, encoding);
        next();
      }
    })

    this.tlsSocket = new Tls.TLSSocket(this.fakeIncomingSocket, {
      secureContext: Tls.createSecureContext(pems)
    });
  }

  on() {
    this.tlsSocket.on.apply(this.tlsSocket, arguments);
  }

  write(data) {
    this.fakeIncomingSocket.push(data);//emit('data', data);
  }

  end() {
    this.fakeIncomingSocket.end();
  }
}

/**
 * A SpaceKitRelay either proxies data between the SpaceKitService and local
 * servers or is pings the service every minute for dynamic DNS to stay
 * updated.
 */
class SpaceKitRelay {
  constructor (config) {
    this.config = config; // fa59e0b6-20ca-4eed-b419-aa7c96238ee4

    this.config.email = 'm@mcav.com'; //XXXXXXXX

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
    this.pems = null;

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

  prepareTlsCertificates() {
    if (this.config.forwardTls) {
      return;
    }

    let challengeValue = null;

    this.acmeChallengeServer = Http.createServer((req, res) => {
      res.writeHead(200);
      res.end(challengeValue);
    }).listen(0);

    let le = LetsEncrypt.create({
      server: LetsEncrypt.stagingServerUrl,
      configDir: './certs',
      privkeyPath: ':config/live/:hostname/privkey.pem',
      fullchainPath: ':config/live/:hostname/fullchain.pem',
      certPath: ':config/live/:hostname/cert.pem',
      chainPath: ':config/live/:hostname/chain.pem',
      debug: false,
    }, {
      setChallenge: (args, key, value, cb) => {
        let hostname = args.domains[0];
        challengeValue = value;
        cb(null);
      },
      getChallenge: (args, key, cb) => {
        cb(null, challengeValue);
      },
      removeChallenge: (args, key, cb) => {
        challengeValue = null;
        cb(null);
      },
    });

    //console.log("CALLING LE REGISTER", this.hostname, this.config.email);

    le.register({
      domains: [this.hostname],
      email: this.config.email,
      agreeTos: true
    }, (err, pems) => {
      //console.log("REGISTER RESULT", err, JSON.stringify(pems));
      this.pems = pems;
      //cb(err, pems);
    });
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
      this.prepareTlsCertificates();
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
    switch (header.type) {
      case 'open':
        if (this.pems) {
          if (header.port === 443) {
            header.port = 80;
          }
          socket = new TransparentTlsSocket(Net.connect(header.port), this.pems);
        } else {
          if (this.acmeChallengeServer && header.port === 80) {
            header.port = this.acmeChallengeServer.address().port;
          }
          socket = Net.connect(header.port);
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
          log.error({ err: err, port: header.port }, 'endpoint socket error event');

          this.sendMessage({
            connectionId: id,
            type: 'close'
          }, null);
        });
        break;
      case 'data':
        socket.write(body)
        break;
      case 'close':
        socket.end();
        this.outgoingSockets.delete(header.connectionId);
        break;
    }
  }
}

module.exports = SpaceKitRelay;
