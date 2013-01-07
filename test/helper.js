var assert = global.assert = require('chai').assert;
var config = require('../.mapper.json');
var Mapper = require('..');
var utils = require('../lib/utils');

module.exports = {
  assert: assert,
  Mapper: Mapper,
  config: config,
  QueryBuilder: require('../lib/queryBuilder')
};

