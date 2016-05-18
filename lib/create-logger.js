'use strict';
const Bunyan = require('bunyan');

const log = Bunyan.createLogger({
  name: 'SpaceKit',
  level: process.env.LOG_LEVEL || 'error',
  streams: [{
    stream: process.stdout
  }]
});

module.exports = function createLogger (name) {
  return log.child({ module: name });
};
