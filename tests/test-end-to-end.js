'use strict';
const tap = require('tap');
const SpaceKitService = require('spacekit-service');
const Relay = require('../lib/index');
const PortMap = require('../lib/port-map');
const Http = require('http');

tap.test('end to end', (tap) => {
  let httpServer = Http.createServer((req, res) => {
    res.end('Hi');
  });

  httpServer.on('listening', () => {
    let httpPort = httpServer.address().port;
    let service = new SpaceKitService({
      host: '127.0.0.1.nip.io:8000',
      api: 'api',
      tcpPort: 8000
    });

    let map = new PortMap();
    map.addFromString('8000:' + httpPort);
    let relay = new Relay({
      noTls: true,
      relay: 'relay',
      username: 'user',
      host: '127.0.0.1.nip.io',
      apiKey: '',
      service: 'api',
      portMap: map
    });

    relay.on('connected', () => {
      Http.get('http://relay.user.127.0.0.1.nip.io:8000/', (res) => {
        tap.equal(res.statusCode, 200);
        relay.close();
        httpServer.close();
        service.close();
        tap.end();
      });
    });
  });

  httpServer.listen(0);
});
