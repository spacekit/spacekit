'use strict';
const Express = require('express');
const Uuid = require('node-uuid');

const CreateLogger = require('../../create-logger');

const log = CreateLogger('WebApp');

module.exports = function (config) {
  const www = Express();

  www.use(function (req, res, next) {
    req.log = log.child({ reqId: Uuid.v4() });
    next();
  });

  www.get('/', (req, res, next) => {
    res.send('Welcome to SpaceKit.');
  });

  return www;
};
