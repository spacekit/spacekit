'use strict';

/**
 * A mapping from a sourcePort -> hostname + destinationPort.
 * See the corresponding tests for supported formats.
 *
 * Example:
 *
 *     > let map = new PortMap();
 *     > map.addFromString('80:example.com:9000');
 *     > map.get(80);
 *     { sourcePort: 80,
 *       hostname: 'example.com',
 *       destinationPort: 9000,
 *       string: '80:example.com:9000' }
 */
class PortMap {
  constructor () {
    this.mapping = new Map();
  }

  get (sourcePort) {
    return this.mapping.get(sourcePort);
  }

  get size () {
    return this.mapping.size;
  }

  addFromString (s) {
    let portInfo = PortMap.parsePortString(s);
    if (!portInfo) {
      throw new Error(`unable to parse the string "${s}"`);
    }
    let existingInfo = this.get(portInfo.sourcePort);
    if (existingInfo) {
      throw new Error(`The port mapping "${s}" would overwrite the previous mapping of "${existingInfo.string}".`);
    }
    this.mapping.set(portInfo.sourcePort, portInfo);
    return portInfo;
  }

  static parsePortString (s) {
    let match = /^(?:(\d+):)?(?:\[?(.*?)\]?:)?(\d+)$/i.exec(s);
    if (!match) {
      return null;
    }
    return {
      sourcePort: parseInt(match[1] || 443, 10),
      hostname: match[2] || 'localhost',
      destinationPort: parseInt(match[3], 10),
      string: s
    };
  }
}

module.exports = PortMap;
