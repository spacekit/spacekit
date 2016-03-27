#!/usr/bin/env node
'use strict';
let yargs = require('yargs');
let SpaceKitServer = require('./server');
let SpaceKitRelay = require('./relay');

let argv = yargs.options({
  u: {
    alias: 'username',
    describe: 'your spacekit username'
  },
  a: {
    alias: 'apikey',
    describe: 'your spacekit api key'
  },
  c: {
    alias: 'cert',
    describe: 'path to the TLS cert'
  },
  k: {
    alias: 'key',
    describe: 'path to the TLS key'
  },
  d: {
    alias: 'dnsZone',
    describe: 'an AWS Hosted Zone ID (for dynamic DNS)'
  },
  h: {
    alias: 'host',
    default: 'spacekit.io',
    describe: 'the root hostname of the service'
  },
  p: {
    alias: 'port',
    default: 443,
    describe: 'the port the server binds to'
  },
  s: {
    alias: 'service',
    default: 'api',
    describe: `the service subdomain; uses value with <host> to create
the complete hostname (ex: <service>.<host>)`
  },
  server: {
    describe: `run in server mode; uses value as subdomain with <host>
to create the complete hostname (ex: <server>.<host>)`
  },
  relay: {
    describe: `run in relay mode; uses value as subdomain for dynamic dns
(ex: "<relay>.<username>.<host>")`
  }
})
.group(['relay', 'username', 'apikey', 'host', 'service'], 'Relay options:')
.implies('relay', 'username')
.implies('relay', 'apikey')
.group(['server', 'dnsZone', 'key', 'cert', 'host', 'port'], 'Server options:')
.implies('server', 'dnsZone')
.implies('server', 'key')
.implies('server', 'cert')
.help()
.usage(`
Usage:
  spacekit --relay home -u rizzle -a 9e67e4d
  spacekit --server api -d $HOSTED_ZONE_ID -k /path/to/key -c /path/to/cert`)
.argv;

if (argv.server) {
  module.exports = new SpaceKitServer(argv);
} else if (argv.relay) {
  module.exports = new SpaceKitRelay(argv);
} else {
  yargs.showHelp();
}
