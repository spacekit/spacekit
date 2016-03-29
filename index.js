#!/usr/bin/env node
'use strict';
const Yargs = require('yargs');

const Config = require('./config');
const SpaceKitServer = require('./server');
const SpaceKitRelay = require('./relay');

if (Config.server) {
  module.exports = new SpaceKitServer();
} else if (Config.relay) {
  module.exports = new SpaceKitRelay();
} else {
  Yargs.showHelp();
}
