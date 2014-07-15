/*
 * winston-couchbase.js: Transport for logging to Couchbase
 * inspired by the winston-couchdb project hosted at
 * https://github.com/indexzero/winston-couchdb
 * as well as the winston-mongodb project hosted at
 * https://github.com/indexzero/winston-mongodb
 *
 * (C) 2014 Michael Dreibelbis
 * MIT LICENSE
 *
 */

// standard imports
var util = require('util');

// npm imports
var couchbase = require('couchbase');
var winston = require('winston');
var common = require('winston/lib/winston/common');
var Stream = require('stream').Stream;

// local imports
var wcUtils = require('./util.js');

// default logger options
var defaultOptions = {
  host: 'localhost',
  bucket: 'default',
  username: null,
  password: null,
  level: 'info',
  //keepAlive: false,
  keyFun: wcUtils.keyFun
};

/**
* ### function Couchbase (options)
* #### @options {Object} Options for this instance.
* Constructor function for the Console transport object responsible
* for making arbitrary HTTP requests whenever log messages and metadata
* are received.
*/

function Couchbase(options) {
  options = options || defaultOptions;

  // call parent constructor
  winston.Transport.call(this, options);

  this.name = 'couchbase';
  this.host = options.host || defaultOptions.host;
  this.bucket = options.bucket || defaultOptions.bucket;
  this.username = options.username || defaultOptions.username;
  this.password = options.password || defaultOptions.password;

  this.level = options.level || defaultOptions.level;
  this.keyFun = options.keyFun || defaultOptions.keyFun;

  //this.timeout = this.keepAlive || 10000;
}

// establish inheritance
util.inherits(Couchbase, winston.Transport);

// make available as transport
winston.transports.Couchbase = Couchbase;

/**
 * ensure existence of couchbase client
 */
Couchbase.prototype._ensureClient = function () {
  if (this._client) return this._client;

  this._con = new couchbase.Cluster(this.host,
                                    this.username,
                                    this.password);
  this._client = this._con.openBucket(this.bucket);
  this._ensureView();

  return this._client;
};

Couchbase.prototype.__defineGetter__('client', function () {
  return this._ensureClient();
});


/**
 * ensure existence of view for querying
 */
Couchbase.prototype._ensureView = function(callback) {

  if (this._ensuredView && callback) return callback();

  this._ensuredView = true;

  if (callback) callback();
};

/**
 * log
 * @param level
 * @param message
 * @param meta
 * @param callback
 * Logs the message to couchbase. This is the method that will be called
 * by winston when used as a transport.
 */
Couchbase.prototype.log = function(level, message, meta, callback) {

  var self = this;
  //
  // Fill document to be written
  //
  var doc = common.clone(wcUtils.removeCycles(meta) || {});
  doc.timestamp = new Date();
  doc.message = message;
  doc.level = level;

  //
  // couchbase does not generate id if none is given
  // use key function specified (default id: ts + uuid)
  //
  var docId = self.keyFun();

  //
  // callback for document write
  //
  var writeCallback = function(error, result) { // result not used...
    var params;
    //
    // Propagate error back to Logger
    // to which this instance belongs
    //
    if (error) {
      self.emit('error', error);
      params = ['error', error]
    } else {
      self.emit('logged');
      params = [null, true];
    }
   if (callback) {
     callback.apply(params);
   }
  };

  // Write document to couchbase
  self.client.set(docId, doc, writeCallback);
};


//
// ### function query (options, callback)
// #### @options {Object} Loggly-like query options for this instance.
// #### @callback {function} Continuation to respond to when complete.
// Query the transport. Options object is optional.
//
Couchbase.prototype.query = function (options, callback) {
  if (typeof options === 'function') { // no options specified
    callback = options;
    options = {};
  }
  var self = this,
      query = {};

  // normalize query options
  options = self.normalizeQuery(options);

  // ensure view exists before running query
  if (!self._ensuredView) {
    var _ensureViewCallback = function(error) {
      if (error) {
        return callback(error);
      }
      self.query(options, callback);
    };
    return self._ensureView(_ensureViewCallback);
  }

  // set up query parameters
  query.include_docs = true;
  query.stale = options.stale || false;
  query.limit = options.rows || 0;
  query.skip = options.skip || 0;
  if (options.from) {
    query.startkey = options.from.toISOString();
  }
  if (options.until) {
    query.endkey = options.until.toISOString() +'\u0FFF';
  }
  if (options.order === 'desc') {
    var tmp = ''+query.startkey;
    query.descending = true;
    query.startkey = query.endkey;
    query.endkey = tmp;
  }

  // set up view and query
  var view = self.client.view('Logs', 'byTimestamp', query);
  view.query(function(error, results) {
    if (error) return callback(error);

    // only return the json stored (not couchbase meta info)
    // unless specifically asked for
    if (!options.includeMeta) {
      results = results.map(function(doc) {
        return doc.doc && doc.doc.json;
      });
    } else {
      results = results.map(function(doc) {
        return doc.doc
      });
    }

    // filter fields if needed
    if (options.fields) {
      results.forEach(function (doc) {
        Object.keys(doc).forEach(function (key) {
          if (!~options.fields.indexOf(key)) {
            delete doc[key];
          }
        });
      });
    }
    callback(null, results);
  });
};

//
// ### function stream (options)
// #### @options {Object} Stream options for this instance.
// Returns a log stream for this transport. Options object is optional.
//
Couchbase.prototype.stream = function (options, stream) {
  //TODO: implement
  this.emit('error', 'not implemented');
  return stream || null;
};

module.exports = Couchbase;