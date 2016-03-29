'use strict';
const Async = require('async');
const Bcrypt = require('bcrypt');
const ValidEmail = require('email-validator').validate;
const Uuid = require('node-uuid');

const Db = require('../db');

module.exports = function SignUp (req, res, next) {
  var reply = {
    success: false,
    errors: [],
    apikey: null
  };

  Async.auto({
    validate: function (done) {
      if (!req.body.hasOwnProperty('username')) {
        reply.errors.push('`username` is required');
      } else if (req.body.username.length < 3) {
        reply.errors.push('`username` must be at least 3 characters');
      }

      if (!req.body.hasOwnProperty('email')) {
        reply.errors.push('`email` is required');
      } else if (!ValidEmail(req.body.email)) {
        reply.errors.push('`email` has an invalid format');
      }

      done(reply.errors.length === 0 ? null : true);
    },
    username: ['validate', function (done, results) {
      let username = req.body.username;
      let query = 'SELECT id FROM users WHERE username = $1';

      Db.run(query, [username], (err, result) => {
        if (err) {
          reply.errors.push('exception during username check');
          return done(true);
        }

        if (result.rows.length !== 0) {
          reply.errors.push(`\`username\` (${username}) already in use`);
          return done(true);
        }

        done(null, username);
      });
    }],
    email: ['validate', function (done, results) {
      let email = req.body.email;
      let query = 'SELECT id FROM users WHERE email = $1';

      Db.run(query, [email], (err, result) => {
        if (err) {
          reply.errors.push('exception during email check');
          return done(true);
        }

        if (result.rows.length !== 0) {
          reply.errors.push(`\`email\` (${email}) already in use`);
          return done(true);
        }

        done(null, email);
      });
    }],
    apikey: ['username', 'email', function (done, results) {
      let uuid = Uuid.v4();

      Async.auto({
        salt: function (done) {
          Bcrypt.genSalt(10, done);
        },
        hash: ['salt', function (done, results) {
          Bcrypt.hash(uuid, results.salt, done);
        }]
      }, (err, results) => {
        if (err) {
          return done(err);
        }

        done(null, {
          plain: uuid,
          hash: results.hash
        });
      });
    }],
    user: ['apikey', function (done, results) {
      let query = `
        INSERT INTO users (username, email, apikey)
        VALUES ($1, $2, $3)
      `;
      let params = [
        results.username,
        results.email,
        results.apikey.hash
      ];

      Db.run(query, params, (err, result) => {
        if (err) {
          reply.errors.push('exception during user insert');
          return done(true);
        }

        reply.success = true;
        reply.apikey = results.apikey.plain;

        done();
      });
    }]
  }, (err, results) => {
    if (err) {
      // do nothing
    }

    res.json(reply);
  });
};
