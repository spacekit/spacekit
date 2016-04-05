'use strict';
const t = require('tap');
const parseConfig = require('../lib/config');

t.throws(() => {
  parseConfig('-r', null, true);
}, { message: /Missing required arguments: u, a/ });

let config = parseConfig('-r relay -u user -a key -p 8000 -p 9000:example.com:9001', null, true);
t.match(config.portMap.get(443), { hostname: 'localhost', destinationPort: 8000 });
t.match(config.portMap.get(9000), { hostname: 'example.com', destinationPort: 9001 });
t.equal(config.portMap.get(10000), undefined);
