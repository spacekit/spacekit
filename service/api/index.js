'use strict';
const BodyParser = require('body-parser');
const Express = require('express');

const SignUp = require('./signup');
const Db = require('../util/db');

module.exports = function (config) {
  const api = Express();

  api.db = new Db(config);
  api.use(BodyParser.json());
  api.use(BodyParser.urlencoded({ extended: true }));

  api.get('/', (req, res, next) => {
    res.json({ message: 'Welcome to the SpaceKit api.' });
  });

  api.post('/signup', SignUp);

  return api;
};
