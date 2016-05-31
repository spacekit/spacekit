'use strict';

// Allow us to use self-signed certificates for testing.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const tap = require('tap');
const SpaceKitService = require('spacekit-service');
const Relay = require('../lib/index');
const PortMap = require('../lib/port-map');
const Http = require('http');
const Https = require('https');

tap.test('end to end', (tap) => {
  let httpServer = Http.createServer((req, res) => {
    res.end('Hi');
  });

  httpServer.on('listening', () => {
    let httpPort = httpServer.address().port;
    let service = new SpaceKitService({
      host: '127.0.0.1.nip.io',
      api: 'api',
      httpsPort: 9443,
      httpPort: 9080
    });

    let map = new PortMap();
    map.addFromString('9443:' + httpPort);
    let relay = new Relay({
      noTls: true,
      relay: 'relay',
      username: 'user',
      host: '127.0.0.1.nip.io:9443',
      apiKey: '',
      service: 'api',
      portMap: map
    });

    relay.on('connected', () => {
      Https.get('https://relay.user.127.0.0.1.nip.io:9443/', (res) => {
        tap.equal(res.statusCode, 200);
        relay.close();
        httpServer.close();
        service.close();
        tap.end();
      });
    }).on('error', (err) => {
      tap.threw(err);
    });
  });

  httpServer.listen(0);
});
