'use strict';
const Bunyan = require('bunyan');

const log = Bunyan.createLogger({
  name: 'SpaceKit',
  level: process.env.LOG_LEVEL || 'fatal',
  streams: [{
    stream: process.stdout
  }]
});

function createLogger (name) {
  return log.child({ module: name });
}

// Unfortunately, node-letsencrypt spits out raw logging to the console.
// Let's wrap those with Bunyan.
const letsEncryptLog = createLogger('LetsEncrypt');
['debug', 'log', 'warn', 'error'].forEach((method) => {
  let originalFn = console[method];
  console[method] = function () {
    if (/letsencrypt\/lib/.test(new Error().stack)) {
      letsEncryptLog[method].apply(letsEncryptLog, arguments);
    } else {
      originalFn.apply(console, arguments);
    }
  };
});

module.exports = createLogger;
