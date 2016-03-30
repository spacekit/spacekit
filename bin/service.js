#!/usr/bin/env node
'use strict';
const Config = require('../config/service');
const SpaceKitService = require('../service');

module.exports = new SpaceKitService(Config);
