# Mapper-pg

A lightweight PostgreSQL data mapper that likes SQL.

## Install

To install

    npm install mapper-pg --save

To test it

    npm install -d
    make test

To run Backbone example

    make test             # creates the necessary database and table
    node example/app.js   # runs the server, browse http://localhost:3000

## TODO

* Transaction support

## Documentation

See comprehensive tests in `test/integration/integrationTest.js`.


## Quickstart


Require it

    var Mapper = require('mapper-pg');

Define Data Access Objects (DAO) for each table

    // simple, only table name with optional primary key
    var Comment = Mapper.map('Comments');
    var Post = Mapper.map('Posts', 'id');

Define relationships beetween DAOS, see `lib/relation.js`

    Post.hasMany('comments', Comment, 'postId');
    Comment.belongsTo('post', Post, 'postId');

Initialize

    // set `verbose`  to trace SQL, set `strict` for invalid column warnings
    var config = { user: 'boo', password: 'secret', database: 'app_dev', verbose: true, strict: false };

    Mapper.initialize(config, function(err) {
        // setup express, etc
    });


## CRUD Examples

Create

    var insertId;

    // insert a new post
    Post.insert({title: 'First Post'}).exec(function(err, result) {
        insertId = result.id;
    });

    // OR sugar
    Post.create({title: 'First Post'}, function(err, result) {
        insertId = result.id;
    });

Retrieve

    // select inserted post
    Post.where({id: insertId}).one(function(err, post) {
        assert.equal(post.title, 'First Post,');
    });

    // OR sugar
    Post.findById(insertId, function(err, post) {});

Update

    // update inserted post
    Post
      .update()                         // optional since set() is used
      .set({title: 'New Title'})
      .where({id: insertId})
      .exec(function (err, result) {
        assert.equal(result.rowCount, 1);
      });

    // OR sugar, updates based on id
    Post.save({title: 'New Title', id: insertId}, function(err, result) {});

Delete

    // delete all posts with a specific title
    Post.delete().where({title: 'New Title'}).exec(function(err, result) {
        assert.equal(result.rowCount, 1);
    });

    // OR sugar
    Post.deleteById(insertId, function(err, result) {});

Gets the first page of posts and populate comments property with
the second page of comments for each post retrieved.

    Post
      .select('id', 'title', 'excerpt')
      .page(0, 25)
      .order('id DESC')
      .load('comments', function(c) {
        c.select('comment', 'created_at')
         .order('id DESC')
         .page(1, 50);
      })
      .all(function(err, posts) {
        // boo-yah!
      });

Or, mix SQL

    var sql = ('SELECT id, title, excerpt FROM Posts ORDER BY id DESC LIMIT 25';

    Post.all(sql, function(err, posts) {
      Post.load('comments', function(c) {
        c.sql('SELECT comment, createdAt FROM Comments ORDER BY id DESC LIMIT 50 OFFSET 50');
      }).in(posts, function(err) {
        // boo-yah!
      });
    });


## SQL goodness

Execute multiple statements in a series

    Mapper.client.series([
      'SELECT * FROM posts WHERE author = ?;', [1],

      // use commas to break up SQL
      'SELECT * ',
      'FROM comments WHERE author = ?;', [1]
    ], function(err, results) {
        // posts are in results[0][0..n]
        // comments are in results[1][0..n]
    });

Execute multiple statements in parallel

    Mapper.client.parallel([
      'SELECT * FROM posts WHERE author = ?;', [1],
      'SELECT * FROM comments WHERE author = ?;', [1],
    ], function(err, results) {
        //...
    });
