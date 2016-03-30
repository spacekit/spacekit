'use strict';
const Yargs = require('yargs');

const argv = Yargs
  .usage('Usage: spacekit home -u rizzle -a 9e67e4d')
  .options({
    u: {
      required: true,
      alias: 'username',
      describe: 'your spacekit username'
    },
    a: {
      required: true,
      alias: 'apikey',
      describe: 'your spacekit api key'
    },
    h: {
      alias: 'host',
      default: 'spacekit.io',
      describe: 'the root hostname of the service'
    },
    s: {
      alias: 'service',
      default: 'api',
      describe: `the service subdomain; uses value with <host> to create
the complete hostname (ex: <service>.<host>)`
    }
  })
  .demand(1) // relay name
  .help()
  .argv;

argv.relay = argv._[0]; // relay name is the first argument

module.exports = argv;
