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
    },
    smtpHost: {
      required: true,
      default: 'smtp.gmail.com',
      describe: 'the smtp host'
    },
    smtpPort: {
      required: true,
      default: 465,
      describe: 'the smtp post'
    },
    smtpFrom: {
      required: true,
      default: 'SpaceKit <spacekit.io@gmail.com>',
      describe: 'the smtp from address'
    },
    smtpUser: {
      required: true,
      describe: 'the smtp username'
    },
    smtpPass: {
      required: true,
      describe: 'the smtp password'
    }
  })
  .help()
  .argv;

argv.nodemailer = {
  host: argv.smtpHost,
  port: argv.smtpPort,
  secure: true,
  auth: {
    user: argv.smtpUser,
    pass: argv.smtpPass
  }
};

module.exports = argv;