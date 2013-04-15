var prompt = require("./prompt");
var fs = require('fs');
var async = require("async");
var db = require("pg");
var _ = require('lodash');
var utils = require('../../lib/utils');

var tableQueries = [
  "CREATE TABLE users ( \
     id SERIAL primary key, \
     user_name varchar(255), \
     first_name varchar(255), \
     last_name varchar(255), \
     created_at timestamp default current_timestamp \
  )",

  "CREATE TABLE posts (\
    id SERIAL primary key,\
    title character varying(255) NOT NULL,\
    blurb character varying(255),\
    body text NOT NULL,\
    published boolean,\
    created_at date,\
    updated_at date\
  )",

  "CREATE TABLE tags (\
    id SERIAL,\
    name varchar(64)\
  )",

  "CREATE TABLE post_tags (\
    id SERIAL primary key,\
    post_id int not null,\
    tag_id int not null\
  )",

  "CREATE TABLE post_more_details (\
    id SERIAL primary key,\
    post_id int not null,\
    extra varchar(132)\
  )",

  "CREATE TABLE comments (\
    id SERIAL primary key,\
    post_id integer NOT NULL,\
    comment text NOT NULL,\
    created_at date\
  )",

  "CREATE TABLE todos (\
    id SERIAL primary key, \
    \"text\" varchar(255), \
    done boolean, \
    \"order\" int \
  )",

  "CREATE TABLE todos2 (\
    id SERIAL primary key, \
    \"text\" varchar(255), \
    done boolean, \
    \"order\" int \
  )",

  "CREATE INDEX comments_post_id \
    ON comments(post_id)\
  "
];

console.log("\nMapper-pg. Please enter your PostgreSQL credentials " +
            "and a database for us to create.\n");

async.series({
  user: function(cb) { prompt("username: ", cb); },
  password: function(cb) { prompt("password: ", null, true, cb); },
  database: function(cb) { prompt("database: ", "mapper_test", cb); },
  host: function(cb) { prompt("host: ", "localhost", cb); },
  port: function(cb) { prompt("port: ", 5432, cb); }
}, function(err, config) {

  config.password = config.password === null ? '' : config.password;
  console.log(config);

  function createDatabase(cb) {
    var copy = _.clone(config);
    copy.database = 'postgres';

    // create the database
    db.connect(utils.buildConnectionString(copy), function(err, client) {
      if (err) return console.error(err);
      var dbQueries = [
        "DROP DATABASE IF EXISTS "+config.database+';',
        "CREATE DATABASE "+config.database+' OWNER '+config.user+';'
      ];

      utils.execSeries(client, dbQueries, function(err) {
        client.end();
        return cb(err);
      });
    });
  }

  function createTables(cb) {
    // create the tables in new database
    db.connect(utils.buildConnectionString(config), function(err, client) {
      if (err) return console.error(err);

      utils.execSeries(client, tableQueries, function(err) {
        client.end();
        if (err) return cb(err);
        fs.writeFile('.mapper.json', JSON.stringify(config), cb);
      });
    });
  }

  async.series([createDatabase, createTables], function(err) {
    if (err) {
      console.error(err);
    }
    else {
      console.log('OK');
    }
    process.exit();
  });

});
