'use strict';

const Http = require('http');
const LetsEncrypt = require('letsencrypt');
const Tls = require('tls');

const CreateLogger = require('./create-logger');
const log = CreateLogger('TlsCertificateGenerator');

class TlsCertificateGenerator {

  constructor () {
    this._pems = null;
    this.acmePort = null;
    this.hostname = null;
  }

  generateCertificate (hostname) {
    let challengeValue = null;
    if (this.hostname && this.hostname !== hostname) {
      throw new Error(`we don't support generating multiple certs yet`);
    }
    this.hostname = hostname;

    let acmeChallengeServer = Http.createServer((req, res) => {
      res.writeHead(200);
      res.end(challengeValue);
    }).listen(0, () => {
      this.acmePort = acmeChallengeServer.address().port;
    });

    let le = LetsEncrypt.create({
      server: LetsEncrypt.productionServerUrl,
      configDir: './certs',
      privkeyPath: ':config/live/:hostname/privkey.pem',
      fullchainPath: ':config/live/:hostname/fullchain.pem',
      certPath: ':config/live/:hostname/cert.pem',
      chainPath: ':config/live/:hostname/chain.pem',
      debug: false
    }, {
      setChallenge: (args, key, value, cb) => {
        challengeValue = value;
        cb(null);
      },
      getChallenge: (args, key, cb) => {
        cb(null, challengeValue);
      },
      removeChallenge: (args, key, cb) => {
        challengeValue = null;
        cb(null);
      }
    });

    setInterval(() => {
      log.info('Checking certificate status for "${hostname}"...');
      this.generateCertificate(hostname);
    }, TlsCertificateGenerator.CHECK_RENEW_INTERVAL);

    le.fetch({
      domains: [hostname]
    }, (err, pems) => {
      if (pems && pems.expiresAt > Date.now() + TlsCertificateGenerator.RENEW_IF_EXPIRES_WITHIN_MS) {
        this._pems = pems;
        log.info(
          `We already have a valid certificate for "${hostname}". ` +
          `It expires on ${new Date(pems.expiresAt).toLocaleDateString()}. `);
        log.info(`We'll attempt to renew it automatically a week before it expires.`);
      } else if (err || !err /* to make linter happy */) {
        le.register({
          domains: [hostname],
          email: 'spacekit.io@gmail.com',
          agreeTos: true
        }, (err, pems) => {
          if (err) {
            log.error(err, 'Failed to obtain TLS certificate!');
          }
          this._pems = pems;
          log.info(`Got a new certificate for "${hostname}".`);
        });
      }
    });
  }

  hasValidCertificate () {
    return !!this._pems;
  }

  createSecureContext () {
    return Tls.createSecureContext({
      key: this._pems.privkey,
      cert: this._pems.fullchain,
      ca: this._pems.ca
    });
  }
}

TlsCertificateGenerator.RENEW_IF_EXPIRES_WITHIN_MS = 1000 * 60 * 60 * 24 * 7;
TlsCertificateGenerator.CHECK_RENEW_INTERVAL = 1000 * 60 * 60 * 24;

module.exports = TlsCertificateGenerator;
