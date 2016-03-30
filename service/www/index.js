'use strict';
const Express = require('express');

module.exports = function (config) {
  const www = Express();

  www.get('/', (req, res, next) => {
    res.send('Welcome to SpaceKit.');
  });

  return www;
};
