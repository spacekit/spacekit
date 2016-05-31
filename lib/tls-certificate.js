'use strict';

const Pem = require('pem');
const Tls = require('tls');

const CreateLogger = require('./create-logger');
const log = CreateLogger('TlsCertificate');

let LetsEncrypt;
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
  LetsEncrypt = require('letsencrypt');
} else {
  LetsEncrypt = {
    create () {
      return {
        fetch: getSelfSignedCertificate,
        register: getSelfSignedCertificate
      };
    }
  };
}

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
          console.log('Traffic routed through SpaceKit is encrypted end-to-end.');
          console.log('We are now generating a new TLS certificate with LetsEncrypt.');
          console.log('This can take up to one minute, and it only needs to be done once.\n');
          process.stdout.write('Please wait...');
          let dotsInterval = setInterval(() => {
            process.stdout.write('.');
          }, 1500);
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
                clearInterval(dotsInterval);
                console.log('\n');
                reject(err);
              } else {
                clearInterval(dotsInterval);
                console.log('\nSuccess! We will automatically renew your certificate when necessary.\n');
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
        console.error('*************************************************************');
        console.error('Failure: We were unable to obtain a TLS certificate for you:\n', err);
        console.error('*************************************************************');
        console.error('This is fatal and unexpected. Please submit a bug report. :(');
        throw err;
      });
  }
}

function getSelfSignedCertificate (options, cb) {
  Pem.createCertificate({
    days: 90,
    commonName: options.domains[0]
  }, (err, keys) => {
    if (err) {
      cb(err);
    } else {
      cb(null, {
        privkey: keys.serviceKey,
        fullchain: keys.certificate,
        ca: undefined,
        expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 90
      });
    }
  });
}

module.exports = TlsCertificate;
