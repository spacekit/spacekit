'use strict';
const Net = require('net');

/**
 * Create a server that extracts the hostname from incoming
 * TLS (SNI) connections, puts the data back on the socket, and
 * hands you back the socket and hostname.
 *
 * @param {function(socket, hostname)} connectionHandler
 * @return {Net.Server}
 */
function createTlsProxyServer (connectionHandler) {
  return Net.createServer((socket) => {
    socket.once('data', (initialData) => {
      socket.pause();
      socket.unshift(initialData);
      const hostname = extractHostnameFromSNIBuffer(initialData);
      connectionHandler(socket, hostname);
      socket.resume();
    });
  });
}

module.exports = createTlsProxyServer;

/*
SNI parsing code
via https://github.com/axiak/filternet/blob/master/lib/sniparse.js

Copyright (c) 2012, Michael C. Axiak
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the <organization> nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

// Given a buffer for a TLS handshake packet
// the function getSNI will look for
// a server_name extension field
// and return the server_name value if found.
// See RFC 3546 (tls) and RFC 4366 (server extension)
// for more details.

function extractHostnameFromSNIBuffer (buffer) {
  if (buffer.readInt8(0) !== 22) {
    // not a TLS Handshake packet
    return null;
  }
  // Session ID Length (static position)
  let currentPos = 43;
  // Skip session IDs
  currentPos += 1 + buffer[currentPos];
  // skip Cipher Suites
  currentPos += 2 + buffer.readInt16BE(currentPos);
  // skip compression methods
  currentPos += 1 + buffer[currentPos];
  // We are now at extensions!
  currentPos += 2; // ignore extensions length
  while (currentPos < buffer.length) {
    if (buffer.readInt16BE(currentPos) === 0) {
      // we have found an SNI
      let sniLength = buffer.readInt16BE(currentPos + 2);
      currentPos += 4;
      if (buffer[currentPos] !== 0) {
        // the RFC says this is a reserved host type, not DNS
        return null;
      }
      currentPos += 5;
      return buffer.toString('utf8', currentPos, currentPos + sniLength - 5);
    } else {
      currentPos += 4 + buffer.readInt16BE(currentPos + 2);
    }
  }
  return null;
}
