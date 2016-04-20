#!/usr/bin/env node
'use strict';
const parseConfig = require('../lib/config');
const DynamicDns = require('../lib/dynamic-dns');
const Relay = require('../lib/relay');

let config = parseConfig(process.argv, 'spacekit.json');

if (config.noProxy) {
  module.exports = new DynamicDns(config);
} else {
  module.exports = new Relay(config);
}
