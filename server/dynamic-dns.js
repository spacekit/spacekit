'use strict';

const AWS = require('aws-sdk');
AWS.config.credentials = new AWS.SharedIniFileCredentials({
  profile: 'spacekit'
});

class DynamicDNS {

  constructor (hostedZoneId) {
    this.hostedZoneId = hostedZoneId;
    this.route53 = new AWS.Route53();
  }

  upsert (hostname, recordType, recordValue) {
    var params = {
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
              TTL: 1
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
