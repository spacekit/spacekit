#!/usr/bin/env node
'use strict';
let yargs = require('yargs');
let SpaceKitServer = require('./server');
let SpaceKitRelay = require('./relay');

let argv = yargs
.options({
  cert: { describe: 'path to the TLS cert' },
  key: { describe: 'path to the TLS key' },
  port: { default: 443 },
  dnsZone: { describe: 'an AWS Hosted Zone ID (for dynamic DNS)' },
  endpoint: { describe: 'the spacekit server hostname', default: 'api.spacekit.io' },
  server: { describe: 'run in server mode (as an endpoint for relays to connect to)' }
})
.demand(1) // <hostname>
.group(['endpoint', 'h'], 'Options:')
.group(['server', 'dnsZone', 'key', 'cert', 'port'], 'Server Options:')
.implies('server', 'key')
.implies('server', 'cert')
.alias('h', 'help')
.help('h')
.usage(`Usage: $0 <hostname>`)
.argv;

argv.hostname = argv._[0]; // hostname is the first positional argument

if (argv.server) {
  module.exports = new SpaceKitServer(argv);
} else {
  module.exports = new SpaceKitRelay(argv);
}
