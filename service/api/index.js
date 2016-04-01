'use strict';
const BodyParser = require('body-parser');
const Express = require('express');
const Uuid = require('node-uuid');

const CreateLogger = require('../../create-logger');
const Db = require('../util/db');
const Mailer = require('../util/mailer');
const Recover = require('./recover');
const Reset = require('./reset');
const SignUp = require('./signup');

const log = CreateLogger('ApiApp');

module.exports = function (config) {
  const api = Express();

  api.mailer = new Mailer(config);
  api.db = new Db(config);
  api.use(BodyParser.json());
  api.use(BodyParser.urlencoded({ extended: true }));

  api.use(function (req, res, next) {
    req.log = log.child({ reqId: Uuid.v4() });
    next();
  });

  api.get('/', (req, res, next) => {
    res.json({ message: 'Welcome to the SpaceKit api.' });
  });

  api.post('/recover', Recover);
  api.post('/reset', Reset);
  api.post('/signup', SignUp);

  return api;
};
