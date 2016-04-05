'use strict';

const EventEmitter = require('events');
const Stream = require('stream');
const Tls = require('tls');

const CreateLogger = require('./create-logger');
const log = CreateLogger('TlsTerminatingSocket');

class TlsTerminatingSocket extends EventEmitter {
  constructor (plainSocket, secureContext) {
    super();

    this.plainSocket = plainSocket;
    this.pair = Tls.createSecurePair(secureContext, /* isServer: */ true);

    this.pair.on('secure', () => {
      log.debug('secure TLS endpoint established');
    });
    this.pair.on('error', (err) => {
      log.error(err, 'error terminating TLS connection');
    });

    this.readable = new Stream.Readable({ read () {} });
    this.writable = new Stream.Writable({
      write: (chunk, encoding, next) => {
        this.emit('data', chunk);
        next();
      }
    });

    this.readable.pipe(this.pair.encrypted);
    this.pair.encrypted.pipe(this.writable);

    plainSocket.pipe(this.pair.cleartext);
    this.pair.cleartext.pipe(plainSocket);
  }

  write (data) {
    this.readable.push(data);
  }

  end () {
    this.plainSocket.end();
  }
}

module.exports = TlsTerminatingSocket;
