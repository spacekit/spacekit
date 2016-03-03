'use strict';

const WebSocket = require('ws');
const net = require('net');
const backoff = require('backoff');

class SpaceKitRelay {
  constructor (argv) {
    this.argv = argv;
    this.url = `wss://${argv.server}/`;

    this.outgoingSockets = new Map();

    this.backoff = backoff.fibonacci({
      randomisationFactor: 0.4,
      initialDelay: 1000,
      maxDelay: 5 * 60000
    });
    this.backoff.on('backoff', (number, delay) => {
      console.log(`Reconnecting in ${delay}ms.\n`);
    });
    this.backoff.on('ready', this.connect.bind(this));
    this.connect();
  }

  connect () {
    console.log(`Connecting to ${this.url}...`);
    this.ws = new WebSocket(this.url, 'spacekit', {
      headers: { 'x-spacekit-host': this.argv.hostname }
    });
    this.ws.on('open', () => {
      console.log(`Connected!`);
      this.backoff.reset();
    });
    this.ws.on('message', (message) => {
      this.handleMessage(JSON.parse(message));
    });
    this.ws.on('close', () => {
      console.log(`Lost connection to server.`);
      this.backoff.backoff();
    });
    this.ws.on('error', () => {
      console.log(`Failed to connect to server.`);
      this.backoff.backoff();
    });
  }

  sendMessage (json) {
    this.ws.send(JSON.stringify(json));
  }

  handleMessage (message) {
    let id = message.connectionId;
    let socket = this.outgoingSockets.get(id);

    if (message.type === 'open') {
      socket = net.connect(message.port || this.argv.port);
      this.outgoingSockets.set(id, socket);
      socket.on('data', (data) => {
        this.sendMessage({
          connectionId: id,
          type: 'data',
          data: data.toString('base64')
        });
      });
      socket.on('close', () => {
        this.sendMessage({
          connectionId: id,
          type: 'close'
        });
      });
      socket.on('error', () => {
        this.sendMessage({
          connectionId: id,
          type: 'close'
        });
      });
    } else if (message.type === 'data') {
      socket.write(new Buffer(message.data, 'base64'));
    } else if (message.type === 'close') {
      socket.close();
      this.outgoingSockets.delete(id);
    }
  }
}

module.exports = SpaceKitRelay;

if (require.main === module) {
  const argv = require('yargs')
    .usage('Usage: npm run relay -- --hostname HOSTNAME')
    .help('h')
    .options('server', {
      describe: 'the spacekit server hostname',
      default: 'api.spacekit.io'
    })
    .options('port', {
      describe: 'the port your application server is listening on',
      default: 443
    })
    .options('hostname', {
      describe: 'the hostname of this server, e.g. "home.mcav.spacekit.io"',
      demand: true
    })
    .argv;
  module.exports.instance = new SpaceKitRelay(argv);
}
