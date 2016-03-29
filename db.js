'use strict';
const Pg = require('pg').native;

const Config = require('./config');

class Db {
  static run (query, params, callback) {
    Pg.connect(Config.postgres, (err, client, done) => {
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
