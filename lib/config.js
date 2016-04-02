'use strict';
const Path = require('path');
const Yargs = require('yargs');

let configFile = {};
try {
  let filePath = Path.resolve(process.cwd(), 'spacekit.json');
  configFile = require(filePath);
} catch (e) {}

const argv = Yargs
  .usage('Usage: spacekit -r home -u rizzle -a 9e67e4d')
  .options({
    r: {
      required: true,
      alias: 'relay',
      describe: 'the name of this relay'
    },
    u: {
      required: true,
      alias: 'username',
      describe: 'your spacekit username'
    },
    a: {
      required: true,
      alias: 'apiKey',
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
  .default(configFile)
  .help()
  .argv;

module.exports = argv;
