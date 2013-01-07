/**
 * Module dependencies.
 */

var helper = require("../helper");
var assert = helper.assert;
var mapper = helper.Mapper;
var X = new Date;
var client;

describe("Client", function() {

  before(function(done) {
    //helper.config.verbose = true;
    mapper.initialize(helper.config, function(err) {
      if (err) return done(err);
      client = mapper.client;
      done();
    });
  });


  it('should get a scalar value', function(done) {
    client.scalar('select count(*) from information_schema.columns', function(err, count) {
      assert.ifError(err);
      assert.ok(parseInt(count) >= 0);
      done();
    });
  });


  it('should get a scalar value parameterized', function(done) {
    client.scalar('select count(*) from information_schema.columns where table_name =  ?', ['posts'], function(err, count) {
      assert.ifError(err);
      assert.ok(parseInt(count) >= 0);
      done();
    });
  });


  it('should execute without result', function(done) {
    var unique = X++;

    client.exec('create table T'+unique+'(id int)', function(err) {
      assert.ifError(err);

      client.scalar('select count(*) from T'+unique, function(err, count) {
        assert.equal(count, 0);
        done();
      });
    });
  });


  it('should find rows', function(done) {
    client.all('select * from information_schema.columns limit 2', function(err, rows) {
      assert.equal(rows.length, 2);
      done();
    });
  });


  it('should find single row', function(done) {
    client.first('select * from information_schema.columns', function(err, row) {
      assert.ifError(err);
      assert.ok(row.table_name.length > 0);
      done();
    });
  });


  it('should execute a series of SQL', function(done) {
    client.series([
      'select * from information_schema.columns limit ?;', [2],

      'select count(*)',
      'from information_schema.columns;'
    ], function(err, results) {
      assert.ifError(err);
      assert.equal(results[0].length, 2);
      assert.isTrue(results[1][0].count > 0);
      done();
    });
  });


  it('should execute in parallel multiple SQL statements', function(done) {
    client.parallel([
      'select * from information_schema.columns limit ?;', [2],
      'select count(*) from information_schema.columns;'
    ], function(err, results) {
      assert.ifError(err);
      assert.equal(results.length, 2);
      done();
    });
  });

}); // end Client



