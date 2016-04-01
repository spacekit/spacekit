'use strict';
const Fs = require('fs');
const Handlebars = require('handlebars');
const Markdown = require('nodemailer-markdown').markdown;
const Nodemailer = require('nodemailer');
const Path = require('path');

class Mailer {
  constructor (config) {
    this.config = config;
    this.templateCache = {};
    this.transport = Nodemailer.createTransport(config.nodemailer);
    this.transport.use('compile', Markdown({ useEmbeddedImages: true }));
  }

  renderTemplate (signature, context, callback) {
    if (this.templateCache[signature]) {
      return callback(null, this.templateCache[signature](context));
    }

    let filePath = Path.resolve(__dirname, `../emails/${signature}.hbs.md`);
    let options = { encoding: 'utf-8' };

    Fs.readFile(filePath, options, (err, source) => {
      if (err) {
        return callback(err);
      }

      this.templateCache[signature] = Handlebars.compile(source);
      callback(null, this.templateCache[signature](context));
    });
  }

  sendEmail (options, template, context, callback) {
    this.renderTemplate(template, context, (err, content) => {
      if (err) {
        return callback(err);
      }

      options.from = this.config.smtpFrom;
      options.markdown = content;

      this.transport.sendMail(options, callback);
    });
  }
}

module.exports = Mailer;
