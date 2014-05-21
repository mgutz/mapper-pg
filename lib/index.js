'use strict';

/**
 * Module dependencies.
 */

var Client = require('./client');
var Dao = require('./dao');
var Utils = require('./utils');
var pkg = require('../package.json');
var async = require('async');


var Mapper = function() {
  // Data Access Objects
  this.daos = {};
  this.version = pkg.version;
  return this;
};


/**
 * Connects to the database and loads all DAO schemas.
 *
 * @param options
 * @param cb
 */
Mapper.prototype.initialize = function(options, cb) {
  if (!options.connectionString) options.connectionString = Utils.buildConnectionString(options);

  this.options = options;
  this.client = new Client(options);

  var client = this.client;
  var daos = this.daos;

  async.forEachSeries(Object.keys(daos), function(key, cb) {
    var dao = daos[key];
    dao.strict = options.strict;
    dao.setClient(client, cb);
  }, function(err) {
    if (err) console.error('ERROR setting schema', err);
    cb(err);
  });
};


/**
 * Maps a table and returns a data access object.
 *
 * @note
 * Declare all mappings before calling connect.
 *
 * @param tableOrOptions
 * @return {Dao}
 */
Mapper.prototype.map = function(tableOrOptions) {
  if (this.client) throw new Error('Mappings must be declared before calling Mapper.connect.');

  var tableName;
  var options;

  if (typeof tableOrOptions === 'string') {
    tableName = tableOrOptions;
    options = { tableName: tableOrOptions };
  }
  else {
    options = tableOrOptions;
    tableName = options.tableName;
  }

  if (!tableName) throw new Error('Table name required.');
  var dao = new Dao(options);
  this.daos[tableName] =  dao;
  return dao;
};


module.exports = new Mapper();
