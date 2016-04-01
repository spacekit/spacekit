'use strict';
const Async = require('async');
const Bcrypt = require('bcrypt');
const ValidEmail = require('email-validator').validate;
const Uuid = require('node-uuid');

module.exports = function Recover (req, res) {
  let reply = {
    success: false,
    errors: [],
    message: null
  };

  Async.auto({
    validate: function (done) {
      if (!req.body.hasOwnProperty('email')) {
        reply.errors.push('`email` is required');
      } else if (!ValidEmail(req.body.email)) {
        reply.errors.push('`email` has an invalid format');
      }

      done();
    },
    replyImmediately: ['validate', function (done, results) {
      // we reply immediatly with a generic response so we don't leak facts

      if (reply.errors.length) {
        res.json(reply);
        return done(Error('Validation errors.'));
      }

      reply.success = true;
      reply.message = 'If that email address matched an account, ' +
                      'an email will be sent with instructions.';

      res.json(reply);

      done();
    }],
    userLookup: ['replyImmediately', function (done, results) {
      let email = req.body.email;
      let query = 'SELECT id FROM users WHERE email = $1';

      req.app.db.run(query, [email], (err, result) => {
        if (err) {
          return done(err);
        }

        if (result.rows.length === 0) {
          return done(Error('User not found.'));
        }

        done(null, result.rows[0]);
      });
    }],
    resetToken: ['userLookup', function (done, results) {
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
    saveToken: ['resetToken', function (done, results) {
      let query = `
        UPDATE users
        SET reset_token = $1, reset_expires = $2
        WHERE id = $3
      `;
      let params = [
        results.resetToken.hash,
        new Date(Date.now() + 10000000),
        results.userLookup.id
      ];

      req.app.db.run(query, params, done);
    }],
    sendMail: ['saveToken', function (done, results) {
      let emailOpts = {
        subject: 'Reset your SpaceKit API key',
        to: req.body.email
      };
      let template = 'recover-api-key';
      let context = {
        resetToken: results.resetToken.plain
      };

      req.app.mailer.sendEmail(emailOpts, template, context, done);
    }]
  }, (err, results) => {
    if (err) {
      console.log(err);
    }

    // do nothing, we already completed the request
  });
};
