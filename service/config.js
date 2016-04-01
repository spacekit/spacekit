'use strict';
const Path = require('path');
const Yargs = require('yargs');

let configFile = {};
try {
  let filePath = Path.resolve(process.cwd(), 'spacekit-service.json');
  configFile = require(filePath);
} catch (e) {}

const argv = Yargs
  .usage(`Usage: spacekit-service \\
       --pg $PG_CONN_STR \\
       --dns $HOSTED_ZONE_ID \\
       --apiKey /path/to/key --apiCert /path/to/cert \\
       --webKey /path/to/key --webCert /path/to/cert`)
  .options({
    pg: {
      required: true,
      default: configFile.pg,
      describe: `the Postgres connection string
(ex: "postgres://username:password@host/database")`
    },
    api: {
      default: configFile.api || 'api',
      describe: `the api subdomain; uses value with <host> to create
the complete hostname (ex: <api>.<host>)`
    },
    apiKey: {
      required: true,
      default: configFile.apiKey,
      describe: 'path to the api TLS key'
    },
    apiCert: {
      required: true,
      default: configFile.apiCert,
      describe: 'path to the api TLS cert'
    },
    web: {
      default: configFile.web || 'www',
      describe: `the web subdomain; uses value with <host> to create
the complete hostname (ex: <web>.<host>)`
    },
    webKey: {
      required: true,
      default: configFile.webKey,
      describe: 'path to the web TLS key'
    },
    webCert: {
      required: true,
      default: configFile.webCert,
      describe: 'path to the web TLS cert'
    },
    dns: {
      default: configFile.dns,
      describe: 'an AWS Hosted Zone ID (for dynamic DNS)'
    },
    host: {
      default: configFile.host || 'spacekit.io',
      describe: 'the root hostname of the service'
    },
    smtpHost: {
      default: configFile.smtpHost || 'smtp.gmail.com',
      describe: 'the smtp host'
    },
    smtpPort: {
      default: configFile.smtpPort || 465,
      describe: 'the smtp post'
    },
    smtpFrom: {
      default: configFile.smtpFrom || 'SpaceKit <spacekit.io@gmail.com>',
      describe: 'the smtp from address'
    },
    smtpUser: {
      required: true,
      default: configFile.smtpUser,
      describe: 'the smtp username'
    },
    smtpPass: {
      required: true,
      default: configFile.smtpPass,
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
