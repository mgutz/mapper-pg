'use strict';

/**
 * Module dependencies.
 */

var async = require('async');
var _ = require('lodash/dist/lodash.underscore');
var Relation = require('./relation');
var RelationType = Relation.RelationType;
var __slice = [].slice;
var relationsCache = {};
var utils = require('./utils');


/**
 * Data Access Object (DAO).
 *
 * A DAO maps 1-1 to a database table and should only contain data access methods.
 */
function Dao(options) {
  this.tableName = options.tableName;
  this.strict = Boolean(options.strict);
  this.options = options;

  // Set in `setClient`. Shown here to document the fields this data access object has.
  this.client = null;
  this.schema = null;
  this.escapedTableName = null;
  this.primaryKey = null;
  this.queryBuilderOptions = null;
  relationsCache[options.tableName] = {};
  return this;
}


/**
 * Set the database client and load the schema for this data access object.
 *
 * @param client
 * @param cb
 */
Dao.prototype.setClient = function(client, cb) {
  var that = this;
  this.client = client;

  loadSchema(client, this.tableName, function(err, schema) {
    if (err) return cb(err);

    that.schema = schema;
    that.escapedTableName = schema.escapedTableName;

    var tableName = that.tableName;
    schema.relations = relationsCache[tableName];
    schema.tableName = tableName;
    if (!schema.primaryKey) schema.primaryKey = that.options.primaryKey || 'id';
    that.primaryKey = schema.primaryKey;

    that.queryBuilderOptions = {
      schema: schema,
      verbose: true,
      strict: false
    };

    cb();
  });
};


/**
 * Defines a 1-many relationship.
 *
 * See [rails has_many](http://guides.rubyonrails.org/association_basics.html#the-has_many-association)
 *
 * @examples
 * PostDao.hasMany('comments', Comment, 'postId')
 */
Dao.prototype.hasMany = function(name, RelationDao, fieldName) {
  addRelation(this, {
      name: name,
      type: RelationType.HAS_MANY,
      RelationDao: RelationDao,
      fieldName: fieldName
  });
  return this;
};


/**
 * Defines a 1-many relationship through a join table.
 *
 * See [rails has_many_through](http://guides.rubyonrails.org/association_basics.html#the-has_many-through-association)
 *
 * @example
 * Post.hasManyThrough('tags', TagDao, 'tagId', PostTagDao, 'postId');
 */
Dao.prototype.hasManyThrough = function(name, RelationDao, joinFieldName, ThroughDao, fieldName) {
  addRelation(this, {
    name: name,
    type: RelationType.HAS_MANY_THROUGH,
    RelationDao: RelationDao,
    joinFieldName: joinFieldName,
    ThroughDao: ThroughDao,
    fieldName: fieldName
  });
  return this;
};


/**
 * Defines a relationship where an entity has a single, related entity.
 *
 * See [rails has_one](http://guides.rubyonrails.org/association_basics.html#the-has_one-association)
 *
 * @example
 * UserDao.hasOne('location', LocationDao, 'locationId')  // one location through self.locationId
 */
Dao.prototype.hasOne = function(name, RelationDao, fieldName) {
  addRelation(this, {
    name: name,
    type: RelationType.HAS_ONE,
    RelationDao: RelationDao,
    fieldName: fieldName
  });
  return this;
};


/**
 * Defines a relationship where a child collection belongs to
 * another.
 *
 * See [rails belongs_to](http://guides.rubyonrails.org/association_basics.html#the-belongs_to-association)
 *
 * @example
 * CommentDao.belongsTo('post', Post, 'postId');
 */
Dao.prototype.belongsTo = function(name, RelationDao, fieldName) {
  addRelation(this, {
    name: name,
    type: RelationType.BELONGS_TO,
    RelationDao: RelationDao,
    fieldName: fieldName
  });
  return this;
};


/**
 * Expose QueryBuilder methods which return a Relation object.
 *
 * Don't get cute like Rails and build these  dynamically. It's not much
 * boilerplate code and it's easier to follow.
 */

/**
 * Creates a delete Relation.
 *
 * @see Relation
 */
Dao.prototype.delete = function(clause) {
  return applyRelationMethod(this, null, 'delete', arguments);
};

/**
 * Creates an insert Relation.
 *
 * @see Relation
 */
Dao.prototype.insert = function(clause) {
  return applyRelationMethod(this, null, 'insert', arguments);
};

/**
 * Creates a select Relation.
 *
 * @see Relation
 */
Dao.prototype.select = function(clause) {
  return applyRelationMethod(this, null, 'select', arguments);
};

/**
 * Creates an update Relation.
 *
 * @see Relation
 */
Dao.prototype.update = function(clause) {
  return applyRelationMethod(this, null, 'update', arguments);
};

/**
 * Loads a relation when a Relation is executed.
 */
Dao.prototype.load = function(clause) {
  return applyRelationMethod(this, 'select', 'load', arguments);
};

/**
 * Creates an update Relation then calls `Relation#set`.
 *
 * @see Relation
 */
Dao.prototype.set = function(clause) {
  return applyRelationMethod(this, 'update', 'set', arguments);
};

/**
 * Saves an object using its primary key.
 *
 * @see Relation
 */
Dao.prototype.save = function(obj, cb) {
  var relation = new Relation(this);
  var keyName = this.schema.primaryKey;
  var keyValue = obj[keyName];
  var props = _.omit(obj, keyName);

  relation.update().set(props).id(keyValue).exec(cb);
};

/**
 * Creates a select Relation then calls `Relation#where`.
 *
 * @see Relation
 */
Dao.prototype.where = function() {
  return applyRelationMethod(this, 'select', 'where', arguments);
};

Dao.prototype.sql = function() {
  return applyRelationMethod(this, null, 'sql', arguments);
};


/**
 * Sugar functions.
 */

/**
 * Creates a new row in the database.
 *
 * @example.
 * PostDao.create({title: 'Some title.'}, cb);
 */
Dao.prototype.create = function(obj, cb) {
  this.insert(obj).first(cb);
};

Dao.prototype.deleteById = function(id, cb) {
  this.delete().id(id).exec(cb);
};

Dao.prototype.findById = function(id, cb) {
  this.id(id).first(cb);
};


/**
 * Direct fetch functions.
 */

/**
 * Executes a query if provided, else fetches all rows.
 *
 * @example
 * dao.all('SELECT * FROM daos WHERE id = ?', [1], cb);
 * dao.all('SELECT * FROM daos', cb);
 * dao.all(cb);
 */
Dao.prototype.all = function(cb) {
  if (arguments.length === 1)
    this.client.all('SELECT * FROM '+this.escapedTableName, cb);
  else
    this.client.all.apply(this.client, __slice.call(arguments, 0));
};


Dao.prototype.count = function(cb) {
  this.client.scalar('SELECT count(*) FROM '+this.escapedTableName, cb);
};


Dao.prototype.first = function(cb) {
  if (arguments.length === 1)
    this.client.first('SELECT * FROM '+this.escapedTableName + ' LIMIT 1;', cb);
  else
    this.client.first.apply(this.client, __slice.call(arguments, 0));
};


Dao.prototype.truncate = function(cb) {
  this.client.exec('TRUNCATE '+this.escapedTableName, cb);
};




/**
 * Private functions
 */

function addRelation(that, relation) {
  var tableName = that.tableName;
  relationsCache[tableName][relation.name] = relation;
}


var schemaCache = {};

function loadSchema(client, tableName, cb) {
  if (schemaCache[tableName]) return cb(null, schemaCache[tableName]);

  var database = client.options.database;

  var queries  = [
    'SELECT column_name, is_nullable, data_type, character_maximum_length, column_default ',
    'FROM information_schema.columns ',
    'WHERE table_catalog = ? AND table_name = ?;',
    [database, tableName],

    'select column_name',
    'from information_schema.table_constraints TC',
    'inner join information_schema.key_column_usage KCU on TC.constraint_name = KCU.constraint_name',
    'where constraint_type = ? and TC.table_catalog = ? and TC.table_name = ?;',
    ['PRIMARY KEY', database, tableName]
  ];


  client.series(queries, function(err, results) {
    if (err) return cb(err);

    var rows = results[0];
    var primaryKey;
    var primaryKeyRow = results[1][0];
    if (primaryKeyRow) primaryKey = primaryKeyRow.column_name;
    if (client.strict && !primaryKey) {
      console.error('STRICT WARNING: Primary Key not defined in database for `'+tableName+'`.');
    }

    var schema =  {
      _fields: rows,
      tableName: tableName,
      primaryKey: primaryKey
    };
    utils.escapeNames(schema);

    schemaCache[tableName] = schema;
    return cb(null, schema);
  });
}


function applyRelationMethod(that, method, method2, args) {
  var relation = new Relation(that);
  if (method) relation[method]();
  return relation[method2].apply(relation, __slice.call(args, 0));
}

module.exports = Dao;
