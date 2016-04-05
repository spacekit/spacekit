'use strict';
const t = require('tap');
const PortMap = require('../lib/port-map');

[
  ['80', 443, 'localhost', 80],
  ['8000:host', null],
  ['host:9000', 443, 'host', 9000],
  ['[::1]:9000', 443, '::1', 9000],
  ['8000:host:9000', 8000, 'host', 9000],
  ['8000:[::1]:9000', 8000, '::1', 9000]
].forEach((testCase) => {
  let expectedResult = testCase[1] === null ? null : {
    sourcePort: testCase[1],
    hostname: testCase[2],
    destinationPort: testCase[3],
    string: testCase[0]
  };
  t.same(
    PortMap.parsePortString(testCase[0]),
    expectedResult,
    `parsing "${testCase[0]}"`);
});
