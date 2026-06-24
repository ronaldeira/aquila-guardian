var test = require('node:test');
var assert = require('node:assert');
var { createLogger } = require('../src/logger');

test('logger redacts live secret values', function () {
  var lines = [];
  var log = createLogger({ sink: function (l) { lines.push(l); }, secrets: ['supersecret'] });
  log.info('connecting with supersecret');
  assert.ok(lines.length === 1);
  assert.ok(!lines[0].includes('supersecret'));
  assert.ok(lines[0].includes('***'));
  assert.ok(lines[0].includes('INFO'));
});
