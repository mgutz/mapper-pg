'use strict';

/**
 * Module dependencies.
 */

var _ = require('lodash');
var async = require('async');
var hstore = require('pg-hstore');

/**
 * Utils.
 */

// var doubleQuote = exports.doubleQuote = function(value, outValues) {
//   if (nil(value)) {
//     return 'NULL';
//   } else if (_(value).isNumber()) {
//     return value;
//   } else if (_(value).isArray()) {
//     return '(' + toCsv(value, outValues) + ')';
//   } else if (_(value).isDate()) {
//     return ''' + toDateTime(value) + ''';
//   } else {
//     return ''' + value + ''';
//   }
// };


var fieldIsValid = exports.fieldIsValid = function(model, field) {
  return _.include(model._columns, field.split('.')[0]);
};


var hasWhiteSpace = exports.hasWhiteSpace = function(value) {
  return /\s/g.test(value);
};


var keysFromObject = exports.keysFromObject = function(fields) {
  return _(fields).chain()
    .map(function(field) {
      return _(field).keys();
    })
    .flatten()
    .uniq()
    .value();
};


var nil = exports.nil = function(value) {
  if (typeof value === 'undefined' || value === null || _.isNaN(value)) {
    return true;
  } else if (Array.isArray(value) && _.isEmpty(value)) {
    return true;
  } else if (value.toString() === '[object Object]' && _.isEmpty(value)) {
    return true;
  } else if (_.isString(value) && _.isEmpty(value)) {
    return true;
  } else {
    return false;
  }
};


var quote = exports.quote = function(outValues, operator) {
  if (operator === 'IN' || operator === 'NOT IN') {
    var valuePos = _.range(1, outValues.length+1);
    var values = _.reduce(valuePos, function(memo, pos, i) {
      memo += '?';
      if (i + 1 !== valuePos.length) memo += ',';
      return memo;
    }, '');
    return '(' + values + ')';
  } else {
    return '?';
  }
};


var toCsv = exports.toCsv = function(list, keys, outValues) {
  return  _.chain(list)
          .values()
          .map(function(o) { outValues.push(o); return '?'; })
          .join(',')
          .value();
};


var toDateTime = exports.toDateTime = function(value) {
  if (_.isDate(value)) {
    return value.getFullYear()
    + '/' + (value.getMonth()+1)
    + '/' + (value.getDate())
    + ' ' + (value.getHours())
    + ':' + (value.getMinutes())
    + ':' + (value.getSeconds());
  }
};


var validFields = exports.validFields = function(model, fields) {
  var returnFields = {}, value, key;
  for (key in fields) {
    value = fields[key];
    if (fieldIsValid(model, key)) {
      returnFields[key] = value;
    }
  }
  return returnFields;
};


/**
 * Builds PostgreSQL connection string from config object.
 *
 * @param config
 * @return {String}
 */
function buildConnectionString(config) {
  var protocol = config.protocol || 'tcp';
  var connString = protocol + '://';
  var host = config.host || 'localhost';

  if (config.user) {
    connString += config.user;
    if (config.password) {
      connString +=':' + config.password;
    }
    connString += '@';
  }

  connString += host;
  if (config.port) connString += ':' + config.port;

  if (config.database) connString += '/' + config.database;

  return connString;
}
exports.buildConnectionString = buildConnectionString;


/**
 * Executes an array of queries against a PG client.
 *
 * @param client Postgres connected client.
 * @param {String[]} queries
 * @param cb
 */
function execSeries(client, queries, cb) {
  async.forEachSeries(queries, function(sql, cb) {
    console.log('SQL=> ' + sql);
    client.query(sql, cb);
  }, cb);
}
exports.execSeries = execSeries;


function execParallel(client, queries, cb) {
  async.forEach(queries, function(sql, cb) {
    console.log('SQL=> ' + sql);
    client.query(sql, cb);
  }, cb);
}
exports.execParallel = execParallel;


function escape(val, t) {
  if (val === undefined || val === null) {
    return 'NULL';
  }
  if (Array.isArray(val)) t = 'array';

  t || (t = typeof val);

  switch (t) {
    case 'boolean':
      return (val) ? 'true' : 'false';
    case 'number':
      return val+'';
    case 'array':
      var sanitized = val.map(function( v ) { return escape(v); } );
      return sanitized.join(',');
    case 'hstore':
      return hstore.stringify(val);
    case 'object':
      val = (typeof val.toISOString === 'function')
        ? val.toISOString()
        : val.toString();
      break;
  }


  // if (Array.isArray(val)) {
  //   var sanitized = val.map(function( v ) { return escape(v); } );
  //   return sanitized.join(',');
  // }

  // if (typeof val === 'object') {
  //   val = (typeof val.toISOString === 'function')
  //     ? val.toISOString()
  //     : val.toString();
  // }

  val = val.replace(/['\\\0\n\r\b\t\x1a]/g, function(s) {
    switch(s) {
      case '\0': return '\\0';
      case '\n': return '\\n';
      case '\r': return '\\r';
      case '\b': return '\\b';
      case '\t': return '\\t';
      case '\x1a': return '\\Z';
      case '\'': return '\'\'';
      default: return '\\'+s;
    }
  });
  return '\''+val+'\'';
}
exports.escape = escape;


function escapeCsvObjectValues(obj, keys) {
  if (!keys) keys = Object.keys(obj);

  var i, item, len, result = '';
  for (i = 0, len = keys.length; i < len; i++) {
    item = obj[keys[i]];
    if (i > 0)
      result += ', ';
    result += escape(item);
  }
  return result;
}
exports.escapeCsvObjectValues = escapeCsvObjectValues;


/**
 * Formats prepared statement.
 *
 * @param sql
 * @param params
 * @return {String}
 */
function format(sql, params) {
  // need clone for shifting
  params = params ? params.concat() : [];

  sql = sql.replace(/\?/g, function() {
    if (params.length == 0) {
      throw new Error('ZERO parameters given');
    }
    var val = params.shift();
    return escape(val);
  });

  if (params.length) {
    throw Error('too many parameters given');
  }

  return sql;
}
exports.format = format;


/**
 * Escapes names in the schema and stores them so it is not performed when building statements.
 *
 * @param schema
 */
function escapeNames(schema) {
  schema.columns = _.pluck(schema._fields, 'column_name');
  schema.escapedColumns = {};
  schema.columns.forEach(function(name) {
    schema.escapedColumns[name] = '"' + name + '"';
  });
  schema.escapedTableName = '"' + schema.tableName + '"';
}
exports.escapeNames = escapeNames;
