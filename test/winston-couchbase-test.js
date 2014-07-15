/**
 * winston-couchbase-test.js includes all tests for winston-couchbasejs
 *
 * (C) 2014 Michael Dreibelbis
 * MIT LICENSE
 *
 */

// npm imports
var vows = require('vows');
var transport = require('winston/test/transports/transport');

// local imports
var Couchbase = require('../lib/winston-couchbase');

vows.describe('winston/transports/Couchbase').addBatch({
  'An instance of the Couchbase Transport': transport(Couchbase, {})
}).export(module);
