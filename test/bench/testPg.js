var async = require('async');
var config = require('../../.mapper.json');
var pg = require('pg');
var verbose = false;


function testPostgresql(cb) {
  pg.connect(config, function(err, client) {
    if (err) return cb(err);

    var iteration = 0;
    async.whilst(
      function() { return iteration < 100000; },

      function (cb) {
        iteration++;
        if (iteration % 2 === 0) {
          client.query("insert into users(user_name, first_name, last_name) values('pg', 'is', 'cool');", function(err, result) {
            if (verbose && iteration === 2) console.log(result);
            cb(err);
          });
        } else {
          client.query('select user_name, first_name, last_name from users limit 50;', function(err, result) {
            if (verbose && iteration === 3) console.log(result.rows);
            cb(err);
          });
        }
      },

      function(err) {
        if (err) console.error(err);
        cb(err);
      }
    );
  });
}


testPostgresql(function(err) {
  if (err) console.error(err);
  process.exit();
});

