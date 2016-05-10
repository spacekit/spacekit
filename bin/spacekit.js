#!/usr/bin/env node
'use strict';
const Async = require('async');
const Commander = require('commander');
const Fs = require('fs');
const Os = require('os');
const PackageJson = require('../package.json');
const Path = require('path');
const PortMap = require('../lib/port-map');
const Promptly = require('promptly');
const Relay = require('../lib/index');
const Request = require('request');

Commander
  .version(PackageJson.version)
  .usage('<name> [portMappings...]')
  .parse(process.argv)
;

if (!Commander.args.length) {
  Commander.outputHelp();
  console.log('Error: missing name');
  process.exit(1);
}

if (Commander.args.length < 2) {
  Commander.outputHelp();
  console.log('Error: missing port mapping');
  process.exit(1);
}

class Cli {
  constructor () {
    this.configPath = Path.resolve(Os.homedir(), 'spacekit.json');
    this.config = {
      service: 'api',
      host: 'spacekit.io',
      username: '',
      apiKey: ''
    };

    try {
      this.config = Object.assign(this.config, require(this.configPath));

      this.startRelay();
    } catch (e) {
      this.registerRequest();
    }
  }

  startRelay () {
    this.config.relay = Commander.args.shift();
    this.config.portMap = new PortMap();

    Commander.args.forEach((portString) => {
      try {
        this.config.portMap.addFromString(portString);
      } catch (e) {
        console.log('Error: port map failed. %s', e);
        process.exit(1);
      }
    });

    new Relay(this.config);
  }

  registerRequest () {
    let msg = 'Would you like to create a new account?';
    Promptly.prompt(msg, { default: 'yes' }, (err, value) => {
      if (err) {
        console.log('Exception prompting input.');
        return;
      }

      if (value === 'yes') {
        console.log('Ok, let\'s create an account...');
        this.register();
      } else {
        console.log('Ok, please enter your credentials...');
        this.configure();
      }
    });
  }

  register () {
    Async.auto({
      username: (done) => {
        let options = this._username
          ? { default: this._username } : undefined;
        Promptly.prompt('Username', options, done);
      },
      email: ['username', (done) => {
        let options = this._email
          ? { default: this._email } : undefined;
        Promptly.prompt('Email', options, done);
      }]
    }, (err, results) => {
      if (err) {
        console.log('Exception prompting input.');
        return;
      }

      this._username = results.username;
      this._email = results.email;

      let options = {
        uri: 'https://api.spacekit.io/signup',
        method: 'POST',
        json: {
          username: results.username,
          email: results.email
        }
      };

      Request(options, (err, res, body) => {
        if (err) {
          console.log('Error: exception making signup request');
          return;
        }

        if (body.success) {
          this.config.username = results.username;
          this.config.apiKey = body.apiKey;

          this.saveConfig();
          this.startRelay();
        } else {
          body.errors.forEach((error) => {
            console.log('Error: ', error);
          });

          console.log('Let\'s try that again...');

          this.register();
        }
      });
    });
  }

  configure () {
    Async.auto({
      username: (done) => {
        Promptly.prompt('Username', done);
      },
      apiKey: ['username', (done) => {
        Promptly.prompt('Api key', done);
      }]
    }, (err, results) => {
      if (err) {
        console.log('Exception prompting input.');
        return;
      }

      this.config.username = results.username;
      this.config.apiKey = results.apiKey;

      this.saveConfig();
      this.startRelay();
    });
  }

  saveConfig () {
    let contents = JSON.stringify(this.config, undefined, 2);

    Fs.writeFile(this.configPath, contents, (err) => {
      if (err) {
        console.log('Error: saving config failed');
        return;
      }
    });
  }
}

new Cli();
