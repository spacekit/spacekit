'use strict';
const Pg = require('pg').native;

class Db {
  constructor (config) {
    this.config = config;
  }

  run (query, params, callback) {
    Pg.connect(this.config.pg, (err, client, done) => {
      if (err) {
        return callback(err);
      }

      client.query(query, params, (err, result) => {
        done(); // releases client

        callback(err, result);
      });
    });
  }
}

module.exports = Db;
