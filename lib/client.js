'use strict';

/**
 * Module dependencies.
 */
var pg = require('pg');
var _ = require('lodash');
var async = require('async');
var QueryBuilder = require('./queryBuilder');
var utils = require('./utils');


/**
 * Client.
 *
 * @param {Object} options = {
 *  # pass either a connection string
 *  {String} [connectionString] 'tcp://user:password/host:port/database'
 *
  * # or pass parts of connection string and it will be assembled
 *  {String} [database]
 *  {string} [user]
 *  {String} [password]
 *  {String} [host] Defaults to 'localhost'
 *  {Number} [port] Defaults to 5432
 *
 *  {Boolean} [verbose] Whether to display SQL statements. Default is false.
 *  {Boolean} [strict] Whether to throw errors when a non-table column is passed to SQL operation.
 * }
 */
function Client(options) {
  this.options = options || {};

  this.connectionString = options.connectionString || Utils.buildConnectionString(options);

  this.lastError = null;
  this.verbose = !!options.verbose;
  this.strict = !!options.strict;
  return this;
}


Client.prototype.acquire = function(cb) {
  pg.connect(this.connectionString, cb);
};


/**
 * Executes a query, acquiring a connection as needed.
 *
 * @param query
 * @param [values]
 * @param cb
 */
Client.prototype.exec = function(query, values, cb) {
  // values is optional.
  if (arguments.length === 2) {
    cb = values;
    values = null;
  }

  var that = this;
  this.acquire(function(err, client) {
    if (err) return cb(err);
    that.execClient(client, query, values, cb);
  });
};


/**
 * Executes a query through an existing client connection.
 *
 * @param client
 * @param query
 * @param values
 * @param cb
 */
Client.prototype.execClient = function(client, query, values, cb) {
  if (values) {
    // arrays may contain arrays for IN operator
    if (typeof values[0] !== 'undefined') values = _.flatten(values);
    query = utils.format(query, values);
  }

  if (this.verbose) console.log('SQL=> '+query);

  client.query(query, function(err, result) {
    //console.log('RESULT', result);
    if (err)  {
      console.error('SQL=>', query);
      console.error(err);
      return cb(err);
    }

    cb(null, result);
  });
};


/**
 * Disconnects the client from the database.
 */
Client.prototype.disconnect = function() {
  this.client.end();
};


/**
 * Execute `sql` and return a column value.
 *
 * @example
 * mapper.client.executeScalar('select count(*) from posts where title like ?', ['%foo%'], cb);
 */
Client.prototype.scalar = function(sql, values, cb) {
  if (arguments.length === 2) {
    cb = values;
    values = null;
  }

  this.exec(sql, values, function(err, result) {
    if (err) return cb(err);

    var first = result.rows[0];
    var scalar = first[Object.keys(first)[0]];

    cb(null, scalar);
  });
};


/**
 * Executes `sql` and returns one or more rows.
 *
 * @example
 * mapper.client.query('select title, blurb from posts where title = ?', ['a title'], cb);
 */
Client.prototype.all = function(statement, values, cb) {
  if (arguments.length === 2) {
    cb = values;
    values = null;
  }

  this.exec(statement, values, function(err, result) {
    if (err) return cb(err);
    cb(null, result.rows);
  });
};



/**
 * Executes `sql` and returns exactly one row.
 *
 * @example
 *
 */
Client.prototype.first = function(sql, values, cb) {
  if (arguments.length === 2) {
    cb = values;
    values = null;
  }

  // limit to one record only, not foolproof
  var SQL = sql.toUpperCase();
  if (SQL.indexOf('SELECT') === 0 && SQL.indexOf('LIMIT 1') < 0) {
    var L = SQL.length;
    if (SQL[L - 1] === ';')
      SQL = sql.substr(0, L - 1) + ' LIMIT 1;';
    else
      SQL = sql + ' LIMIT 1';
  }
  else {
    SQL = sql;
  }

  this.exec(SQL, values, function(err, result) {
    if (err) return cb(err);
    if (result.rowCount)
      cb(null, result.rows[0]);
    else
      cb(null, null);
  });
};


/**
 * Executes an array of statements either in parallel or series.
 *
 * @param method
 * @param statements
 * @param cb
 * @private
 */
Client.prototype._execSeriesParallel = function(method, statements, cb) {
  var that = this;
  var i, arg, L;

  // convert each query into an array for function.apply
  // ('select foo', 'from bar where id = ?', [1])
  // becomes ['select foo', 'from bar where id = ?', [1]]
  var queryArgs = [];
  var statement = [];
  for (i = 0, L = statements.length; i < L; i++) {
    var isEndOfStatement = false;
    arg = statements[i];

    // an array (values for a statement) terminates a statement
    if (Array.isArray(arg)) {
      isEndOfStatement = true;
    }
    // end of args
    else  if (i + 1 >= L) {
      isEndOfStatement =  true;
    }
    // string ends with ';' and it has no statement args
    else if (arg[arg.length - 1] === ';') {
      var peek = statements[i+1];
      if (!Array.isArray(peek))
        isEndOfStatement = true;
    }

    if (isEndOfStatement) {
      statement.push(arg);
      queryArgs.push(statement);
      statement = [];
    }
    else {
      statement.push(arg);
    }
  }

  var results = [];
  var resultPos = 0;
  async[method](queryArgs, function(statementArgs, cb) {
    (function(pos) {
      var qb = new QueryBuilder();
      var sql = qb.sql.apply(qb, statementArgs).toSql();
      // ensure same client is used
      that.acquire(function(err, client) {
        that.execClient(client, sql, null, function(err, result) {
          if (err) return cb(err);
          results[pos] = result.rows;
          cb();
        });
      });
    })(resultPos);
    resultPos++;
  }, function(err) {
    cb(err, results);
  });
};


/**
 * Runs a series of SQL statements, returning an array of results.
 *
 * Example
 *  // each query is terminated by an array containing arguments
 *  Mapper.client.execSeries([
 *    'select * from id = ?;', [id],
 *    'select foo', 'from bar', 'where id = 3;',     // Statement without args MUST end with semicolon!
 *    'select foo from bar;'
 *  ], function(err, results) {
 *  });
 */
Client.prototype.series = function(statements, cb) {
  this._execSeriesParallel('forEachSeries', statements, cb);
};


Client.prototype.parallel = function(statements, cb) {
  this._execSeriesParallel('forEach', statements, cb);
};


module.exports = Client;
