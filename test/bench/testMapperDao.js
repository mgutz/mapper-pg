var async = require("async")
  , config = require("../../.mapper.json")
  , Mapper = require("../..");

var UserDao = Mapper.map("users");

function testMapper(cb) {
  var iteration = 0;
  var insertId;
  async.whilst(
    function() { return iteration < 100000; },

    function (cb) {
      iteration++;
      if (iteration % 2 === 0) {
        UserDao
          .insert({user_name: "mapper", first_name: "is", last_name: "fast"})
          .first(function(err, result) {
            if (err) return cb(err);
            //if (iteration === 2)  console.log(result);
            insertId = result.id;
            cb(err);
          });
      } else {
        UserDao
          .select('user_name', 'first_name', 'last_name')
          .limit(50)
          .all(function(err, found) {
            //if (iteration === 3)  console.log(found);
            cb(err);
          });
      }
    },

    function(err) {
      if (err) console.error(err);
      cb(err);
    }
  );
}

Mapper.initialize(config, function(err) {
  if (err) {
    console.error(err);
    process.exit();
  }
  testMapper(function(err) {
    process.exit();
  });
});
