'use strict';
const Path = require('path');
const Yargs = require('yargs');

const CreateLogger = require('./create-logger');
const log = CreateLogger('Config');

function parse (args, configFilename, noExit) {
  let builder = Yargs
    .usage('Usage: spacekit -r home -u rizzle -a 9e67e4d')
    .options({
      r: {
        required: true,
        alias: 'relay',
        describe: 'the name of this relay'
      },
      u: {
        required: true,
        alias: 'username',
        describe: 'your spacekit username'
      },
      a: {
        required: true,
        alias: 'apiKey',
        describe: 'your spacekit api key'
      },
      h: {
        alias: 'host',
        default: 'spacekit.io',
        describe: 'the root hostname of the service'
      },
      p: {
        alias: 'p',
        describe: 'the port your local server is listening on'
      },
      noTls: {
        default: false,
        boolean: true
      },
      s: {
        alias: 'service',
        default: 'api',
        describe: `the service subdomain; uses value with <host> to create
  the complete hostname (ex: <service>.<host>)`
      },
      noProxy: {
        describe: 'disables the proxy and pings for dynamic dns instead'
      }
    })
    .help();

  if (configFilename) {
    let configFile = {};
    try {
      let filePath = Path.resolve(process.cwd(), configFilename);
      configFile = require(filePath);
      log.info(`Inheriting defaults from ${configFilename}.`);
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        log.debug('No configuration file found. Using argv only.');
      } else {
        log.error(`There's a problem with your ${configFilename}`, e);
        if (noExit) {
          throw e;
        } else {
          process.exit(1);
        }
      }
    }

    builder = builder.default(configFile);
  }

  if (noExit) {
    builder = builder.exitProcess(false);
    builder = builder.fail((msg, err) => {
      throw err || new Error(msg);
    });
  }

  const argv = builder.parse(args || process.argv);

  // Parse "-p" arguments into a PortMap.
  const PortMap = require('./port-map');
  if (!Array.isArray(argv.p)) {
    argv.p = argv.p ? [argv.p] : [];
  }

  argv.portMap = new PortMap();
  for (let portString of argv.p) {
    try {
      let portInfo = argv.portMap.addFromString(portString);
      log.info(`Mapping ${portInfo.sourcePort} to ${portInfo.hostname}:${portInfo.destinationPort}`);
    } catch (e) {
      log.error(e);
      if (noExit) {
        throw e;
      } else {
        process.exit(1);
      }
    }
  }

  return argv;
}

module.exports = parse;
