'use strict';
const Yargs = require('yargs');

const argv = Yargs
  .usage(`Usage: spacekit-service \\
       --pg $PG_CONN_STR \\
       --dns $HOSTED_ZONE_ID \\
       --apiKey /path/to/key --apiCert /path/to/cert \\
       --webKey /path/to/key --webCert /path/to/cert`)
  .options({
    pg: {
      required: true,
      describe: `the Postgres connection string
(ex: "postgres://username:password@host/database")`
    },
    api: {
      default: 'api',
      describe: `the api subdomain; uses value with <host> to create
the complete hostname (ex: <api>.<host>)`
    },
    apiKey: {
      required: true,
      describe: 'path to the api TLS key'
    },
    apiCert: {
      required: true,
      describe: 'path to the api TLS cert'
    },
    web: {
      default: 'www',
      describe: `the web subdomain; uses value with <host> to create
the complete hostname (ex: <web>.<host>)`
    },
    webKey: {
      required: true,
      describe: 'path to the web TLS key'
    },
    webCert: {
      required: true,
      describe: 'path to the web TLS cert'
    },
    dns: {
      describe: 'an AWS Hosted Zone ID (for dynamic DNS)'
    },
    host: {
      default: 'spacekit.io',
      describe: 'the root hostname of the service'
    }
  })
  .help()
  .argv;

module.exports = argv;
