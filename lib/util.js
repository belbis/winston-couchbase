//
// puts utility functions here so i don't have to update winston-couchbase.js
//

var uuid = require('node-uuid');

// for removing cycles in json
var removeCycles = require('cycle').decycle;

// for generating keys (queryable timestamp + uuid)
var keyFun = function() {
  return (new Date).toISOString()+ '-'+uuid();
};

exports.removeCycles = removeCycles;
exports.keyFun = keyFun;