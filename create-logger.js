'use strict';
const Bunyan = require('bunyan');
const Path = require('path');

module.exports = function createLogger (name) {
  return Bunyan.createLogger({
    name: name,
    streams: [{
      stream: process.stdout
    }, {
      type: 'rotating-file',
      path: Path.resolve(process.cwd(), 'spacekit.log'),
      period: '1d', // daily
      count: 3 // three rotations
    }]
  });
};
