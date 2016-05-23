'use strict';

const LetsEncrypt = require('letsencrypt');
const Tls = require('tls');

const CreateLogger = require('./create-logger');
const log = CreateLogger('TlsCertificate');

class TlsCertificate {

  constructor (hostname) {
    this.hostname = hostname;
    this._pems = null;
    this.RENEW_IF_EXPIRES_WITHIN_MS = 1000 * 60 * 60 * 24 * 7;

    this.challengeValue = null;

    this.le = LetsEncrypt.create({
      server: LetsEncrypt.productionServerUrl,
      configDir: './certs',
      privkeyPath: ':config/live/:hostname/privkey.pem',
      fullchainPath: ':config/live/:hostname/fullchain.pem',
      certPath: ':config/live/:hostname/cert.pem',
      chainPath: ':config/live/:hostname/chain.pem',
      debug: false
    }, {
      setChallenge: (args, key, value, cb) => {
        this.challengeValue = value;
        cb(null);
      },
      getChallenge: (args, key, cb) => {
        cb(null, this.challengeValue);
      },
      removeChallenge: (args, key, cb) => {
        this.challengeValue = null;
        cb(null);
      }
    });

    // TODO: Call ensureValidCertificate from an interval, to ensure
    // we don't block a request each time we have to renew.
  }

  _fetchFromCache () {
    return this._pems ? Promise.resolve(this._pems) : Promise.reject(this._pems);
  }

  _fetchFromDisk () {
    return new Promise((resolve, reject) => {
      log.info('Fetching cert from disk', this.hostname);
      this.le.fetch({
        domains: [this.hostname]
      }, (err, pems) => { err ? reject(err) : resolve(pems); });
    });
  }

  ensureValidCertificate () {
    if (this._inProgressPromise) {
      return this._inProgressPromise;
    }

    // To prevent race conditions where we try to call ensureValidCertificate
    // more than once at a time:
    let done;
    this._inProgressPromise = new Promise((resolve) => {
      done = resolve;
    });

    return this._fetchFromCache()
      .catch((err) => {
        if (err) {
          // ignored
        }
        return this._fetchFromDisk();
      })
      .then((pems) => {
        if (pems.expiresAt < Date.now() + this.RENEW_IF_EXPIRES_WITHIN_MS) {
          log.warn(`Certificate expires soon (or is already expired): ${pems.expiresAt}`);
          throw new Error('expiring');
        } else {
          return pems;
        }
      })
      .catch((err) => {
        if (err) {
          // ignored
        }

        return new Promise((resolve, reject) => {
          let firstAttemptTimestamp = Date.now();
          let registerOnce = () => {
            log.info('LE register', this.hostname);
            this.le.register({
              domains: [this.hostname],
              email: 'spacekit.io@gmail.com',
              agreeTos: true
            }, (err, pems) => {
              log.info('LE result', !err);
              if (err && /NXDOMAIN/.test(err.message) &&
                  Date.now() - firstAttemptTimestamp < 90000) {
                log.warn('Waiting for DNS to resolve...');
                setTimeout(registerOnce, 15000);
              } else if (err) {
                reject(err);
              } else {
                resolve(pems);
              }
            });
          };
          registerOnce();
        });
      })
      .then((pems) => {
        log.info(`Certificate is valid! Expires ${pems.expiresAt}`);
        this._pems = pems;
        let secureContext = Tls.createSecureContext({
          key: pems.privkey,
          cert: pems.fullchain,
          ca: pems.ca
        });
        done(secureContext);
        return secureContext;
      }, (err) => {
        done();
        log.error(`Unable to obtain valid certificate: ${err}`);
        throw err;
      });
  }
}

module.exports = TlsCertificate;
