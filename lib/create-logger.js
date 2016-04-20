'use strict';
const Bunyan = require('bunyan');
const Path = require('path');

const log = Bunyan.createLogger({
  name: 'SpaceKit',
  level: 'debug',
  streams: [{
    stream: process.stdout
  }, {
    type: 'rotating-file',
    path: Path.resolve(process.cwd(), 'spacekit.log'),
    period: '1d', // daily
    count: 3 // three rotations
  }]
});

module.exports = function createLogger (name) {
  return log.child({ module: name });
};
