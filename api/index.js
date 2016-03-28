'use strict';
const Express = require('express');

let app = Express();

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the SpaceKit api.' });
});

module.exports = app;
