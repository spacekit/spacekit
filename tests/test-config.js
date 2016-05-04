'use strict';
const tap = require('tap');
const parseConfig = require('../lib/config');

tap.throws(() => {
  parseConfig('-r', null, true);
}, { message: /Missing required arguments: u, a/ });

let config = parseConfig('-r relay -u user -a key -p 8000 -p 9000:example.com:9001', null, true);
tap.match(config.portMap.get(443), { hostname: 'localhost', destinationPort: 8000 });
tap.match(config.portMap.get(9000), { hostname: 'example.com', destinationPort: 9001 });
tap.equal(config.portMap.get(10000), undefined);
