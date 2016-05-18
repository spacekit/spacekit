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
const Request = require('request');

let configPath = Path.resolve(Os.homedir(), 'spacekit.json');
let config = {
  service: 'api',
  host: 'spacekit.io',
  username: '',
  apiKey: ''
};
let state = {
  configFileExists: false,
  relay: undefined,
  username: undefined,
  email: undefined
};

Commander
  .version(PackageJson.version)
  .option('--recover', 'recover your api key')
  .option('--reset', 'reset your api key with recovery token')
  .option('--debug', 'change log level to debug')
  .usage('<name> [portMappings...]')
  .parse(process.argv)
;

if (Commander.debug) {
  process.env.LOG_LEVEL = 'debug';
}

try {
  config = Object.assign(config, require(configPath));
  state.configFileExists = true;
} catch (e) {
  if (process.env.LOG_LEVEL === 'debug') {
    throw e;
  }
}

if (Commander.recover) {
  recover();
} else if (Commander.reset) {
  reset();
} else {
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

  init();
}

function init () {
  if (state.configFileExists) {
    startRelay();
  } else {
    signupRequest();
  }
}

function startRelay () {
  config.relay = Commander.args.shift();
  config.portMap = new PortMap();

  Commander.args.forEach((portString) => {
    try {
      config.portMap.addFromString(portString);
    } catch (e) {
      console.log('Error: port map failed. %s', e);
      process.exit(1);
    }
  });

  // required late so we can change process.env.LOG_LEVEL with option
  const Relay = require('../lib/index');

  state.relay = new Relay(config);
}

function signupRequest () {
  let msg = 'Would you like to create a new account?';
  Promptly.prompt(msg, { default: 'yes' }, (err, value) => {
    if (err) {
      console.log('Exception prompting input.');
      return;
    }

    if (value === 'yes') {
      console.log('Ok, let\'s create an account...');
      signup();
    } else {
      console.log('Ok, please enter your credentials...');
      configure();
    }
  });
}

function signup () {
  Async.auto({
    username: (done) => {
      let options = state.username
        ? { default: state.username } : undefined;
      Promptly.prompt('Username', options, done);
    },
    email: ['username', (done) => {
      let options = state.email
        ? { default: state.email } : undefined;
      Promptly.prompt('Email', options, done);
    }]
  }, (err, results) => {
    if (err) {
      console.log('Exception prompting input.');
      return;
    }

    state.username = results.username;
    state.email = results.email;

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
        config.username = results.username;
        config.apiKey = body.apiKey;

        saveConfig();
        startRelay();
      } else {
        body.errors.forEach((error) => {
          console.log('Error: ', error);
        });

        console.log('Let\'s try that again...');

        signup();
      }
    });
  });
}

function recover () {
  console.log('Ok, let\'s recover your API key...');

  Async.auto({
    email: (done) => {
      let options = state.email
        ? { default: state.email } : undefined;
      Promptly.prompt('Email', options, done);
    }
  }, (err, results) => {
    if (err) {
      console.log('Exception prompting input.');
      return;
    }

    state.email = results.email;

    let options = {
      uri: 'https://api.spacekit.io/recover',
      method: 'POST',
      json: {
        email: results.email
      }
    };

    Request(options, (err, res, body) => {
      if (err) {
        console.log('Error: exception making recover request');
        return;
      }

      if (body.success) {
        console.log(body.message);

        reset();
      } else {
        body.errors.forEach((error) => {
          console.log('Error: ', error);
        });

        console.log('Let\'s try that again...');

        recover();
      }
    });
  });
}

function reset () {
  console.log('Ok, let\'s reset your API key...');

  Async.auto({
    email: (done) => {
      let options = state.email
        ? { default: state.email } : undefined;
      Promptly.prompt('Email', options, done);
    },
    token: ['email', (done) => {
      Promptly.prompt('Recovery token', done);
    }]
  }, (err, results) => {
    if (err) {
      console.log('Exception prompting input.');
      return;
    }

    state.email = results.email;

    let options = {
      uri: 'https://api.spacekit.io/reset',
      method: 'POST',
      json: {
        email: results.email,
        token: results.token
      }
    };

    Request(options, (err, res, body) => {
      if (err) {
        console.log('Error: exception making reset request');
        return;
      }

      if (body.success) {
        config.apiKey = body.apiKey;

        saveConfig();

        console.log('API key reset and saved.');
      } else {
        body.errors.forEach((error) => {
          console.log('Error: ', error);
        });

        console.log('Let\'s try that again...');

        reset();
      }
    });
  });
}

function configure () {
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

    config.username = results.username;
    config.apiKey = results.apiKey;

    saveConfig();
    startRelay();
  });
}

function saveConfig () {
  let contents = JSON.stringify(config, undefined, 2);

  Fs.writeFile(configPath, contents, (err) => {
    if (err) {
      console.log('Error: saving config failed');
      return;
    }
  });
}
