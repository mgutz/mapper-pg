/**
 * Module dependencies.
 */

var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var helper = require('../helper.js');
var mapper = require('../..');

var posts = [
  { id: 1, title: 'Some Title 1', blurb: 'Some blurb 1',
    body: 'Some body 1', published: false },
  { id: 2, title: 'Some Title 2',
    body: 'Some body 2', published: true },
  { id: 3, title: 'Some Title 3', blurb: 'Some blurb 3',
    body: 'Some body 3', published: true },
  { id: 4, title: '\'lol\\"', blurb: 'Extra\'"\\"\'\'--',
    body: '"""--\\\'"', published: false }
];

var comments = [
  { id: 1, post_id: 1, comment: 'Comment 1', created_at: new Date() },
  { id: 2, post_id: 1, comment: 'Comment 2', created_at: new Date() },
  { id: 3, post_id: 2, comment: 'Comment 3', created_at: new Date() },
  { id: 4, post_id: 2, comment: 'Comment 4', created_at: new Date() },
  { id: 5, post_id: 3, comment: 'Comment 5', created_at: new Date() },
  { id: 6, post_id: 3, comment: 'Comment 6', created_at: new Date() },
  { id: 7, post_id: 4, comment: 'Comment 7', created_at: new Date() },
  { id: 8, post_id: 4, comment: 'Comment 8', created_at: new Date() },
  { id: 9, post_id: 4, comment: 'Comment 9', created_at: new Date() }
];


var tags = [
  { id: 1, name: 'funny' },
  { id: 2, name: 'coding' },
  { id: 3, name: 'javascript' },
  { id: 4, name: 'git' }
];

var postsTags = [
  { id: 1, post_id: 1, tag_id: 1 },
  { id: 2, post_id: 1, tag_id: 2 },
  { id: 3, post_id: 2, tag_id: 3 },
  { id: 4, post_id: 2, tag_id: 3 },
  { id: 5, post_id: 3, tag_id: 1 },
  { id: 6, post_id: 4, tag_id: 4 }
];

var moreDetails = [
  { id: 1, post_id: 1, extra: 'extra' }
];


var todos = [
  {id: 1, text: 'Become a rock star', order: 1},
  {id: 2, text: 'Change me', order: 2},
  {id: 3, text: 'Delete', order: 314},
  {id: 4, text: 'Delete2', order: 321},
  {id: 5, text: 'UpdateMe', order: 322}
];


var Comment = mapper.map("comments")
  , Post = mapper.map("posts")
  , PostTag = mapper.map("post_tags")
  , MoreDetail = mapper.map("post_more_details")
  , Tag = mapper.map("tags")
  , Todo = mapper.map("todos2");



// Post has many tags through PostTag.tag_id joined on PostTag.post_id
Post.hasManyThrough("tags", Tag, "tag_id", PostTag, "post_id");

// Post.comments though Comment(post_id)
Post.hasMany("comments", Comment, "post_id");

// Post.moreDetails through PostMoreDetails(post_id)
Post.hasOne("moreDetails", MoreDetail, "post_id");

// Comment.post through Comment(post_id)
Comment.belongsTo("post", Post, "post_id");


/**
 * Integration test.
 */

describe("Dao", function() {

  before(function(done) {
    this.timeout(4000);
    var commands = [
      function(cb) { PostTag.truncate(cb); },
      function(cb) { MoreDetail.truncate(cb); },
      function(cb) { Comment.truncate(cb); },
      function(cb) { Tag.truncate(cb); },
      function(cb) { Post.truncate(cb); },
      function(cb) { Todo.truncate(cb); },

      function(cb) { Post.insert(posts).exec(cb); },
      function(cb) { Comment.insert(comments).exec(cb); },
      function(cb) { Tag.insert(tags).exec(cb); },
      function(cb) { MoreDetail.insert(moreDetails).exec(cb); },
      function(cb) { PostTag.insert(postsTags).exec(cb); },
      function(cb) { Todo.insert(todos).exec(cb); }
    ];

    //helper.config.verbose = true;
    mapper.initialize(helper.config, function(err) {
      if (err) return done(err);
      async.series(commands, done);
    });
  });


  describe("Insert", function() {
    it('should insert into columns named with keywords', function(done) {
      Todo
        .insert({id: 200, text: 'foo', order: 3})
        .first(function(err, todo) {
          assert.ifError(err);
          assert.equal(todo.id, 200);
          done();
        });
    });


    it('should return inserted id', function(done) {
     Tag
        .insert({ id: 100, name: 'Insert Id'})
        .first(function(err, row) {
          assert.ifError(err);
          assert.equal(100, row.id);
          done();
        });
    });

    it('should return alias inserted id', function(done) {
     Tag
        .insert({ id: 101, name: 'Second insert'})
        .returning('id AS insert_id, name')
        .first(function(err, row) {
          assert.equal(101, row.insert_id);
          assert.equal('Second insert', row.name);
          done();
        });
    });

  });


  describe("Select", function() {

    it('should find when column has keyword as name', function(done) {
      Todo
        .where({text: 'Become a rock star'})
        .first(function(err, todo) {
          assert.ifError(err);
          assert.equal(todo.id, 1);
          done();
        });
    });

    it('find a post by primary key using object', function(done) {
      Post
        .where({id: posts[0].id})
        .first(function(err, row) {
          assert.equal(posts[0].title, row.title);
          done();
        });
    });

    it('find a post using raw sql', function(done) {
      Post
        .sql('select title', 'from Posts where id = ?', [posts[0].id])
        .first(function(err, row) {
          assert.equal(posts[0].title, row.title);
          done();
        });
    });

    it('execute multiple queries in a series', function(done) {
      mapper.client
        .series([
          'select title', 'from Posts where id = ?', [posts[0].id],
          'select title from Posts where id = ?', [posts[1].id]
        ], function(err, results) {
            assert.equal(posts[0].title, results[0][0].title);
            assert.equal(posts[1].title, results[1][0].title);
            done();
          }
        )
    });

    it('execute multiple queries in a series without args (requires semicolons)', function(done) {
      mapper.client
        .series([
          'select title', 'from Posts where id = ' + posts[0].id + ';',
          'select title from Posts where id = ' + posts[1].id + ';'
        ], function(err, results) {
            assert.equal(posts[0].title, results[0][0].title);
            assert.equal(posts[1].title, results[1][0].title);
            done();
          }
        )
    });


    it('execute multiple queries in a parallel', function(done) {
      mapper.client
        .parallel([
          'select title', 'from Posts where id = ?', [posts[0].id],
          'select title from Posts where id = ?', [posts[1].id]
        ], function(err, results) {
            assert.ok(results.length == 2);
            var title0 = results[0][0].title;
            var title1 = results[1][0].title;
            assert.ok([title0, title1].indexOf(posts[0].title) >= 0);
            assert.ok([title0, title1].indexOf(posts[1].title) >= 0);
            done();
          }
        )
    });

    it('execute multiple queries in parallel without args (requires semicolons)', function(done) {
      mapper.client
        .parallel([
          'select title', 'from Posts where id = ' + posts[0].id + ';',
          'select title from Posts where id = ' + posts[1].id + ';'
        ], function(err, results) {
            assert.equal(posts[0].title, results[0][0].title);
            assert.equal(posts[1].title, results[1][0].title);
            done();
          }
        )
    });

    it('finds a post using string and only return certain fields', function(done) {
      Post
        .select('id')
        .where('id = ?', [posts[1].id])
        .first(function(err, row) {
          assert.equal(row.id, posts[1].id);
          assert.isUndefined(row.title);
          done();
        });
    });

    it('properly ignores unknown columns', function(done) {
      Post
        .select(['id', 'bad_field'])
        .where({'body': 'Some body 2'})
        .all(function(err, results) {
          assert.equal(1, results.length);
          done();
        })
    });

    it('ignores all unknown columns returning everything', function(done) {
      Post
        .select(['bad_field'])
        .where({id: 1})
        .all(function(err, results) {
          assert.equal(1, results.length);
          done();
        });
    });

    it('ignores empty only clause returning everything', function(done) {
      Post.select([]).where({id: 2 }).all(function(err, results) {
        assert.equal(1, results.length);
        done();
      });
    });

    it('finds using in clause with one item', function(done) {
      Post.where({ 'title IN': [['Some Title 1']] }).all(function(err, results) {
        assert.equal(1, results.length);
        done();
      });
    });

    it('finds using IN clause in string with multiple items', function(done) {
      Post.where('title IN (?)', [['Some Title 1', 'Some Title 2']]).all(function(err, results) {
        assert.equal(2, results.length);
        done();
      });
    });

    it('finds using NOT IN clause with one item', function(done) {
      Post
        .where({'title NOT IN': [['Some Title 1']]})
        .all(function(err, results) {
          assert.equal(3, results.length);
          done();
        });
    });

    it('finds one comment via a basic selector', function(done) {
      Comment.where({ 'comment':'Comment 5' }).first(function(err, comment) {
        assert.equal('Comment 5', comment.comment);
        done();
      });
    });

    it('returns undefined when not found', function(done) {
      Comment.where({ 'comment':'Comment 18' }).first(function(err, comment) {
        assert.equal(undefined, comment);
        done();
      });
    });

    it('finds a post and return alias fields', function(done) {
      Post
        .select('title AS some_alias_title, blurb AS some_alias_blurb')
        .where({ 'id': 1 })
        .first(function(err, row) {
          assert.equal(posts[0].title, row['some_alias_title']);
          assert.equal(posts[0].blurb, row['some_alias_blurb']);
          done();
         });
     });

    it('finds a post and order results descending using aliased columns', function(done) {
        Post.select("title AS some_alias_title, id AS \"some id\"")
          .id([1,2])
          .order("id DESC")
          .all(function(err, results) {
            assert.equal(posts[1].id, results[0]['some id']);
            assert.equal(posts[0].id, results[1]['some id']);
            done();
          });
    });

    it('finds last 2 post ids using offset', function(done) {
      Post.select('id').limit(2).offset(2).all(function(err, results) {
        assert.equal(posts[2].id, results[0].id);
        assert.equal(posts[3].id, results[1].id);
        done();
      })
    });

    it('finds with order and limit', function(done) {
      Post.select('id').order('id DESC').limit(1)
        .all(function(err, results) {
          assert.equal(posts[3].id, results[0].id);
          done();
        })
    });

    it('finds with order and offset', function(done) {
      Post.select('id').order('id DESC').limit(3).offset(1)
        .all(function(err, results) {
          assert.equal(posts[2].id, results[0].id);
          assert.equal(posts[1].id, results[1].id);
          assert.equal(posts[0].id, results[2].id);
          done();
        });
    });

    it('finds with order, offset and limit', function(done) {
      Post.select('id').order('id DESC').limit(2).offset(1)
        .all(function(err, results) {
          assert.equal(posts[2].id, results[0].id);
          assert.equal(posts[1].id, results[1].id);
          done();
         });
    });

    it('finds a post with empty blurbs', function(done) {
      var expected = 0;
      _.each(posts, function(post) {
        if (_.isNull(post.blurb) || _.isUndefined(post.blurb)) { expected++; }
      });

      Post.where({blurb: null}).all(function(err, results) {
        assert.equal(expected, results.length);
        done();
      });
    });

    it('should get first page', function(done) {
      Comment.select('id').page(0, 3).all(function(err, rows) {
        assert.equal(3, rows.length);
        assert.equal(1, rows[0].id);
        assert.equal(2, rows[1].id);
        assert.equal(3, rows[2].id);
        done();
      });
    });

    it('should get last page', function(done) {
      Comment.select('id').page(1, 7).all(function(err, rows) {
        assert.equal(2, rows.length);
        assert.equal(8, rows[0].id);
        assert.equal(9, rows[1].id);
        done();
      });
    });
  }); // end Select


  describe("Relations", function() {
    it('should load child of hasOne relationship', function(done) {
      Post.where('id = ?', [1]).load('moreDetails').first(function(err, post) {
        assert.equal(post.moreDetails.extra, 'extra');
        done();
      });
    });

    it('should load child of hasOne relationship with existing rowset', function(done) {
      Post.where('id = ?', [1]).first(function(err, post) {
        Post.load('moreDetails').in(post, function(err) {
          assert.equal(post.moreDetails.extra, 'extra');
          done();
        });
      });
    });

    it('should load the parent of a belongsTo relationship', function(done) {
      Comment.where('id = ?', [1]).load('post').first(function(err, comment) {
        assert.equal(comment.post.title, 'Some Title 1');
        done();
      });
    });

    it('should load hasMany', function(done) {
      Post
        .load('comments')
        .all(function(err, rows) {
          assert.equal(rows[0].comments.length, 2);
          assert.equal(rows[0].comments[0].id, 1);
          assert.equal(rows[0].comments[1].id, 2);
          assert.equal(rows[3].comments.length, 3);
          assert.equal(rows[3].comments[0].id, 7);
          assert.equal(rows[3].comments[1].id, 8);
          assert.equal(rows[3].comments[2].id, 9);
          done();
        });
    });

    it('should load with callback options', function(done) {
      Post
        .select('id, blurb, published')
        .where({'blurb like': '%Some blurb%', published: true})
        .load('comments', function(c) {
          c.select('id, post_id, comment')
           .order('id');
        })
        .all(function(err, results) {
          assert.equal(2, results[0].comments.length);
          done();
        });
    });

    it('should load with callback options args', function(done) {
      Post
        .select('id, blurb, published')
        .where({'blurb like': '%Some blurb%', published: true})
        .load('comments', function(c) {
          c.select('id', 'post_id', 'comment')
           .order('id');
        })
        .all(function(err, results) {
          assert.equal(2, results[0].comments.length);
          done();
        });
    });

    it('should get the associated rows of a hasManyThrough relationship', function(done) {
      Post
        .where({id: 1})
        .load("tags")
        .first(function(err, post) {
          assert.equal(post.tags.length, 2);
          assert.equal(post.tags[0].name, 'funny');
          assert.equal(post.tags[1].name, 'coding');
          done();
        });
    });
  }); // end Relations


  describe('Update', function() {
    it('should update column name after keyword', function(done) {
      Todo
        .set({text: 'foobar'})
        .where({text: 'Change me'})
        .exec(function(err) {
          Todo
            .where({id: 2})
            .first(function(err, todo) {
              assert.equal('foobar', todo.text);
              done();
            });
        });

    });


    it('should save using object', function(done) {
      Todo
        .where({text: 'UpdateMe'})
        .first(function(err, todo) {
          assert.equal(322, todo.order);
          todo.text = 'hokay';
          Todo.save(todo, function(err, result) {
            assert.equal(1, result.rowCount);
            Todo.where({id: todo.id}).first(function(err, found) {
              assert.equal('hokay', found.text);
              assert.equal(5, found.id);
              done();
            });
          })
        })
    });


    it('new post title', function(done) {
      Post
        .set({'title': 'Renamed Title'})
        .where({ 'title': 'Some Title 1' })
        .exec(function(err, result) {
          assert.equal(1, result.rowCount);
          done();
        });
    });

    it('new post title with weird characters', function(done) {
      var newTitle = '"\'pants';
      Post
        .set({title: newTitle})
        .where('id = 4')
        .exec(function(er, results) {
          assert.equal(1, results.rowCount);
          Post
            .where({id: 4})
            .first(function(er, post) {
              assert.equal(newTitle, post.title);
              done();
            });
        });
    });
  }); // end Update


  describe('Delete', function() {

    it('should delete using column named after keyword', function(done) {
      Todo.delete().where({order: 314}).exec(function(err, result) {
        assert.equal(result.rowCount, 1);
        done();
      });
    });

    it('should delete without where clause', function(done) {
      Todo.delete({order: 321}).exec(function(err, result) {
        assert.equal(result.rowCount, 1);
        done();
      });
    });

    it('comment by primary key', function(done) {
      Comment.delete().id(8).exec(function(err, results) {
        assert.equal(1, results.rowCount);
        done();
      });
    });

    it('multiple comments by primary key', function(done) {
      Comment.delete().id([7, 6]).exec(function(err, result) {
        assert.equal(2, result.rowCount);
        done();
      });
    });

    it('delete comment via a basic selector', function(done) {
      Comment.delete().where({comment:'Comment 5'}).exec(function(err, results) {
        assert.equal(1, results.rowCount);
        done();
      });
    });

    it('delete all', function(done) {
      Comment.delete().exec(function(err, results) {
        assert.equal(5, results.rowCount);
        done(err);
      });
    });

    it('delete nothing via empty selector', function(done) {
      Comment.delete().exec(function(err, results) {
        assert.equal(0, results.rowCount);
        done(err);
      });
    });

    it('error on bad selector', function(done) {
      function test() {
        Comment.delete().where({ 'bad_field': 3 }).exec();
      }
      assert.throws(test, Error);
      done();
    });

  });

}); // end Dao
