'use strict';

const AWS = require('aws-sdk');
AWS.config.credentials = new AWS.SharedIniFileCredentials({
  profile: 'spacekit'
});

class SubdomainUpdater {

  constructor (hostedZoneId, domain) {
    this.hostedZoneId = hostedZoneId;
    this.domain = domain;
    this.route53 = new AWS.Route53();
  }

  updateSubdomainWithIp (subdomain, ipAddress) {
    let hostname = subdomain + '.' + this.domain;
    var params = {
      ChangeBatch: {
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: hostname,
              Type: 'A',
              ResourceRecords: [
                {
                  Value: ipAddress
                }
              ],
              TTL: 1
            }
          }
        ],
        Comment: hostname + ' -> ' + ipAddress
      },
      HostedZoneId: this.hostedZoneId /* required */
    };

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

module.exports = SubdomainUpdater;
