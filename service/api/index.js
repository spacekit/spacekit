'use strict';
const BodyParser = require('body-parser');
const Express = require('express');

const Db = require('../util/db');
const Mailer = require('../util/mailer');
const Recover = require('./recover');
const Reset = require('./reset');
const SignUp = require('./signup');

module.exports = function (config) {
  const api = Express();

  api.mailer = new Mailer(config);
  api.db = new Db(config);
  api.use(BodyParser.json());
  api.use(BodyParser.urlencoded({ extended: true }));

  api.get('/', (req, res, next) => {
    res.json({ message: 'Welcome to the SpaceKit api.' });
  });

  api.post('/recover', Recover);
  api.post('/reset', Reset);
  api.post('/signup', SignUp);

  return api;
};
