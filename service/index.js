'use strict';
const Bcrypt = require('bcrypt');
const Dns = require('dns');
const Fs = require('fs');
const Https = require('https');
const WebSocketServer = require('ws').Server;

const ApiApp = require('./api');
const CreateLogger = require('../create-logger');
const CreateNetProxyServer = require('./net-proxy-server');
const CreateTlsProxyServer = require('./tls-proxy-server');
const Db = require('./util/db');
const DynamicDNS = require('./dynamic-dns');
const WebApp = require('./www');
const WebSocketRelay = require('./web-socket-relay');

const log = CreateLogger('SpaceKitService');

/**
 * The SpaceKitService listens for TLS connections. Depending on the hostname
 * (provided by SNI) of the connection, we'll do the following:
 *
 * If the hostname of the incoming connection is the hostname of SpaceKitService,
 * we will handle the request ourselves (either a WebSocket or HTTPS request).
 *
 * Otherwise, we will transparently proxy that connection to one of the
 * connected client relays serving the requested hostname (if available).
 *
 * If configured, SpaceKitService will act as a dynamic DNS service, updating
 * DNS records to the appropriate client relay.
 */
class SpaceKitService {
  constructor (config) {
    this.config = config;
    this.apiHostname = `${config.api}.${config.host}`;
    this.webHostname = `${config.web}.${config.host}`;
    this.db = new Db(config);
    this.relays = new Map(); // hostname -> WebSocketRelay

    // Listen for any incoming Tls connections.
    CreateTlsProxyServer(this.handleTlsConnection.bind(this)).listen(443);
    // Listen for any incoming Net connections.
    CreateNetProxyServer(this.handleNetConnection.bind(this)).listen(80);

    // An HTTPS server will handle api requests and relay WebSocket upgrades.
    // Note: This server doesn't actually bind itself to a port; we hand it
    // established connections from a TLS proxy handler.
    this.apiServer = Https.createServer({
      key: Fs.readFileSync(config.apiKey),
      cert: Fs.readFileSync(config.apiCert)
    }, ApiApp(config));

    // A WebSocket server will handle relay client connections for the api
    // server.
    this.wss = new WebSocketServer({ server: this.apiServer });
    this.wss.on('connection', this.authenticateRelayConnection.bind(this));
    this.wss.on('headers', (headers) => {
      headers['Access-Control-Allow-Origin'] = '*';
    });
    this.wss.on('error', (err) => {
      log.error(err, 'WebSocketServer error event');
    });

    // An HTTPS server will handle website requests. Note: This server doesn't
    // actually bind itself to a port; we hand it established connections from
    // a TLS proxy handler.
    this.webServer = Https.createServer({
      key: Fs.readFileSync(config.webKey),
      cert: Fs.readFileSync(config.webCert)
    }, WebApp(config));

    // Configure the DNS updater, if applicable.
    if (config.dnsZone) {
      this.dynamicDNS = new DynamicDNS(config.dnsZone);
    }

    log.info('the service has started');
  }

  /**
   * Handle a TLS connection that needs to be forwarded to `hostname`.
   *
   * If this connection's hostname is one of SpaceKit's services, we forward
   * the request to our own HTTPS server.
   *
   * Otherwise, pass the connection onto a client relay for that hostname,
   * if one is available.
   */
  handleTlsConnection (socket, hostname) {
    log.info({ for: hostname }, 'new Tls connection');

    if (hostname === this.apiHostname) {
      this.apiServer.emit('connection', socket);
    } else if (hostname === this.webHostname) {
      this.webServer.emit('connection', socket);
    } else {
      let relay = this.relays.get(hostname);
      if (relay) {
        relay.addSocket(socket, hostname, 443);
      } else {
        let message = 'Relay not connected';
        socket.end(`HTTP/1.1 500 ${message}\r\n\r\n${message}`);
      }
    }
  }

  /**
   * Handle a net (insecure) connection that needs to be forwarded to
   * `hostname`.
   *
   * If this connection's hostname is one of SpaceKit's services, we redirect
   * the request to the secure location.
   *
   * Otherwise we forward ACME certificate exchange requests to a connected
   * relay, so that users can run providers like Let's Encrypt themselves to
   * receive certificates.
   */
  handleNetConnection (socket, hostname, path) {
    log.info({ for: hostname, path: path }, 'new Net connection');

    if (hostname === this.config.host) {
      let response = 'HTTP/1.1 301 Moved Permanently\r\n' +
                     `Location: https://${this.webHostname}${path}\r\n\r\n`;
      socket.end(response);
    } else if (hostname === this.apiHostname || hostname === this.webHostname) {
      let response = 'HTTP/1.1 301 Moved Permanently\r\n' +
                     `Location: https://${hostname}${path}\r\n\r\n`;
      socket.end(response);
    } else {
      if (!path.startsWith('/.well-known/acme-challenge/')) {
        let message = 'Only ACME requests supported';
        return socket.end(`HTTP/1.1 500 ${message}\r\n\r\n${message}`);
      }

      let relay = this.relays.get(hostname);
      if (relay) {
        relay.addSocket(socket, hostname, 80);
      } else {
        let message = 'Relay not connected';
        socket.end(`HTTP/1.1 500 ${message}\r\n\r\n${message}`);
      }
    }
  }

  /**
   * Authenticate an incoming connection from a client relay.
   */
  authenticateRelayConnection (webSocket) {
    let subdomain = webSocket.upgradeReq.headers['x-spacekit-subdomain'];
    let username = webSocket.upgradeReq.headers['x-spacekit-username'];
    let apikey = webSocket.upgradeReq.headers['x-spacekit-apikey'];
    let hostname = `${subdomain}.${username}.${this.config.host}`;
    let existingRelay = this.relays.get(hostname);

    webSocket.log = log.child({ for: hostname });

    webSocket.on('error', (err) => {
      webSocket.log.error({ err: err }, 'relay web socket error event');
    });

    if (existingRelay) {
      webSocket.log.info('relay auth failed (already exists)');
      return webSocket.close();
    }

    let query = `SELECT id, api_key FROM users WHERE username = $1`;

    this.db.run(query, [username], (err, result) => {
      if (err) {
        webSocket.log.error(err, 'relay auth failed (db query error)');
        return webSocket.close();
      }

      if (result.rows.length === 0) {
        webSocket.log.info('relay auth failed (user not found)');
        return webSocket.close();
      }

      Bcrypt.compare(apikey, result.rows[0].api_key, (err, pass) => {
        if (err) {
          webSocket.log.error(err, 'relay auth failed (bcrypt compare error)');
          return webSocket.close();
        }

        if (!pass) {
          webSocket.log.info('relay auth failed (api key incorrect)');
          return webSocket.close();
        }

        webSocket.log.info('relay auth success');

        this.handleRelayConnection(webSocket, hostname);
      });
    });
  }

  /**
   * Handle an incoming connection from a client relay.
   *
   * The webSocket here will send events to any TLS sockets it is associated
   * with. (That magic happens in WebSocketRelay.)
   *
   * If we're configured to update DNS, do so now.
   */
  handleRelayConnection (webSocket, hostname) {
    let relay = new WebSocketRelay(webSocket);

    this.relays.set(hostname, relay);

    webSocket.on('close', () => {
      this.relays.delete(hostname);
    });

    if (this.dynamicDNS) {
      // TODO: Perform DNS resolution of `${this.config.api}.${this.config.host}`
      // only once, not on every request.
      Dns.resolve4(`${this.config.api}.${this.config.host}`, (err, addresses) => {
        if (err) {
          // TODO: Send an error back to the client.
        } else {
          this.dynamicDNS.upsert(hostname, 'A', addresses[0]);
        }
      });
    }
  }
}

module.exports = SpaceKitService;
