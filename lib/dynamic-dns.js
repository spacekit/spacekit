'use strict';
const CreateLogger = require('./create-logger');
const Https = require('https');

const log = CreateLogger('DynamicDns');

/**
 * DynamicDns provides a basic Dynamic DNS client. It connects to
 * the SpaceKit service, pointing the hostname to your public IP address.
 * It automatically updates the DNS entry when your IP address changes.
 */
class DynamicDns {
  constructor (config) {
    this.config = config;
    this.hostname = `${this.config.relay}.${this.config.username}.${this.config.host}`;

    this.pingRequest = {
      protocol: 'https:',
      host: `${this.config.service}.${this.config.host}`,
      port: 443,
      path: '/ping',
      headers: {
        'x-spacekit-subdomain': this.config.relay,
        'x-spacekit-username': this.config.username,
        'x-spacekit-apikey': this.config.apiKey
      }
    };

    this.pingInterval = setInterval(this.pingService.bind(this), 60000);

    log.info(`Running Dynamic DNS for "${this.hostname}"`);

    this.pingService();
  }

  pingService () {
    Https.get(this.pingRequest, (res) => {
      log.debug(`ping response (${res.statusCode})`);
      res.resume();
    }).on('error', (err) => {
      log.error(err, 'ping request error');
    });
  }
}

module.exports = DynamicDns;
