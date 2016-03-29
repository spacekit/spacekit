'use strict';
const Bcrypt = require('bcrypt');
const Dns = require('dns');
const Fs = require('fs');
const Https = require('https');
const WebSocketServer = require('ws').Server;

const Api = require('../api');
const Config = require('../config');
const Db = require('../db');
const CreateTlsProxyServer = require('./tls-proxy-server');
const CreateAcmeProxyServer = require('./acme-proxy-server');
const DynamicDNS = require('./dynamic-dns');
const WebSocketRelay = require('./web-socket-relay');

/**
 * The SpaceKitServer listens for TLS connections. Depending on the hostname
 * (provided by SNI) of the connection, we'll do the following:
 *
 * If the hostname of the incoming connection is the hostname of SpaceKitServer,
 * we will handle the request ourselves (either a WebSocket or HTTPS request).
 *
 * Otherwise, we will transparently proxy that connection to one of the
 * connected client relays serving the requested hostname (if available).
 *
 * If configured, SpaceKitServer will act as a dynamic DNS service, updating
 * DNS records to the appropriate client relay.
 */
class SpaceKitServer {

  constructor () {
    this.relays = new Map(); // hostname -> WebSocketRelay

    // Listen for any incoming TLS connections.
    CreateTlsProxyServer(this.handleTlsConnection.bind(this)).listen(Config.port);

    // An HTTPS server will handle our API requests (and WebSocket upgrades).
    // Note: This server doesn't actually listen for requests; we hand it
    // established connections from the TLS proxy handler.
    this.httpsServer = Https.createServer({
      key: Fs.readFileSync(Config.key),
      cert: Fs.readFileSync(Config.cert)
    }, Api);

    const wss = new WebSocketServer({ server: this.httpsServer });
    wss.on('connection', this.authenticateWebSocketConnection.bind(this));
    wss.on('headers', (headers) => {
      headers['Access-Control-Allow-Origin'] = '*';
    });

    // Listen for LetsEncrypt-style ACME verification requests on port 80
    CreateAcmeProxyServer(this.handleAcmeConnection.bind(this)).listen(80);

    // Configure the DNS updater, if applicable.
    if (Config.dnsZone) {
      this.dynamicDNS = new DynamicDNS(Config.dnsZone);
    }
  }

  /**
   * Handle a connection that needs to be forwarded to `hostname`.
   *
   * If this connection's hostname is SpaceKitServer's, we forward the request
   * to our own HTTPS server.
   *
   * Otherwise, pass the connection onto a client relay for that hostname,
   * if one is available.
   */
  handleTlsConnection (socket, hostname) {
    console.log('new TLS connection', hostname);
    if (hostname === `${Config.server}.${Config.host}`) {
      this.httpsServer.emit('connection', socket);
    } else {
      let relay = this.relays.get(hostname);
      if (relay) {
        relay.addSocket(socket, hostname);
      } else {
        socket.end();
      }
    }
  }

  /**
   * Forward ACME TLS certificate exchange requests to a connected relay,
   * so that users can run providers like Let's Encrypt themselves to receive
   * certificates.
   */
  handleAcmeConnection (socket, hostname) {
    console.log('new ACME connection', hostname);
    if (hostname === `${Config.server}.${Config.host}`) {
      socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
    } else {
      let relay = this.relays.get(hostname);
      if (relay) {
        relay.addSocket(socket, hostname, 80);
      } else {
        socket.end('HTTP/1.1 500 No Relays Available\r\n\r\n');
      }
    }
  }

  /**
   * Authenticate an incoming connection from a client relay.
   */
  authenticateWebSocketConnection (webSocket) {
    let subdomain = webSocket.upgradeReq.headers['x-spacekit-subdomain'];
    let username = webSocket.upgradeReq.headers['x-spacekit-username'];
    let apikey = webSocket.upgradeReq.headers['x-spacekit-apikey'];
    let hostname = `${subdomain}.${username}.${Config.host}`;
    let existingRelay = this.relays.get(hostname);

    if (existingRelay) {
      console.log('ws auth failed', hostname, 'already exists');
      return webSocket.close();
    }

    let query = `SELECT id, apikey FROM users WHERE username = $1`;

    Db.run(query, [username], (err, result) => {
      if (err) {
        console.log('ws auth failed', hostname, 'db query error', err);
        return webSocket.close();
      }

      if (result.rows.length === 0) {
        console.log('ws auth failed', hostname, 'not found');
        return webSocket.close();
      }

      Bcrypt.compare(apikey, result.rows[0].apikey, (err, pass) => {
        if (err) {
          console.log('ws auth failed', hostname, 'bcrypt compare error');
          return webSocket.close();
        }

        if (!pass) {
          console.log('ws auth failed', hostname, 'apikey was incorrect');
          return webSocket.close();
        }

        console.log('ws auth success', hostname);
        this.handleWebSocketConnection(webSocket, hostname);
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
  handleWebSocketConnection (webSocket, hostname) {
    let relay = new WebSocketRelay(webSocket);

    this.relays.set(hostname, relay);

    webSocket.on('close', () => {
      this.relays.delete(hostname);
    });

    if (this.dynamicDNS) {
      // TODO: Perform DNS resolution of `${Config.server}.${Config.host}`
      // only once, not on every request.
      Dns.resolve4(`${Config.server}.${Config.host}`, (err, addresses) => {
        if (err) {
          // TODO: Send an error back to the client.
        } else {
          this.dynamicDNS.upsert(hostname, 'A', addresses[0]);
        }
      });
    }
  }
}

module.exports = SpaceKitServer;
