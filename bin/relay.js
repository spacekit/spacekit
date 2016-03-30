#!/usr/bin/env node
'use strict';
const Config = require('../relay/config');
const SpaceKitRelay = require('../relay');

module.exports = new SpaceKitRelay(Config);
