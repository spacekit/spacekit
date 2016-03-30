#!/usr/bin/env node
'use strict';
const Config = require('../service/config');
const SpaceKitService = require('../service');

module.exports = new SpaceKitService(Config);
