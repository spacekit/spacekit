#!/usr/bin/env node
'use strict';
const Config = require('../config/relay');
const SpaceKitRelay = require('../relay');

module.exports = new SpaceKitRelay(Config);
