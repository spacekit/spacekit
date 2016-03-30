'use strict';
const AWS = require('aws-sdk');

// TODO: configure these via a command-line flag instead
AWS.config.credentials = new AWS.SharedIniFileCredentials({
  profile: 'spacekit'
});

/**
 * A wrapper for Amazon Route 53's DNS service, for the sole purpose of
 * upserting individual hostname records.
 */
class DynamicDNS {

  constructor (hostedZoneId) {
    this.hostedZoneId = hostedZoneId;
    this.route53 = new AWS.Route53();
  }

  upsert (hostname, recordType, recordValue) {
    let params = {
      ChangeBatch: {
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: hostname,
              Type: recordType,
              ResourceRecords: [
                {
                  Value: recordValue
                }
              ],
              TTL: 1 // TODO: make configurable
            }
          }
        ],
        Comment: hostname + ' -> ' + recordValue
      },
      HostedZoneId: this.hostedZoneId /* required */
    };
    console.log('DNS:', hostname, '->', recordValue);

    return new Promise((resolve, reject) => {
      this.route53.changeResourceRecordSets(params, function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
}

module.exports = DynamicDNS;
