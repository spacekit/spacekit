#!/usr/bin/env node
'use strict';
const Config = require('../lib/config');
const SpaceKitRelay = require('../lib');

module.exports = new SpaceKitRelay(Config);
