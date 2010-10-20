var Queue = function(options, callback) {
  var self = this;
  this.messages = [];
  this.pending = [];
  this.collection = null;

  options = options || {};

  if (options.mongo) {
    sys.puts("Queue using mongodb, connecting to " + options.mongo.host + ":" + options.mongo.port);
    this.db = new mongo.Db('node-mongo-queue', new mongo.Server(options.mongo.host, options.mongo.port, {}), {});
    this.db.open(function(err,db) {
      self.collection = db.collection('node-queue', function(err, collection) {
        collection.find(function(err, cursor) {
          cursor.each(function(err, item) {
            if(item != null) {
              self.messages.push(item);
            }
          });
        });
      });
      callback(this);
    });
  } else {
    callback(this);
  }
};

Queue.prototype.enqueue = function(payload, callback) {
  var error = null,
      ts = microseconds.milliseconds(),
      message = {
        message: payload,
        timestamp: ts
      };
  this.messages.push(message);
  if (this.pending.length) {
    (this.pending.shift())(this.messages.shift());
    callback(error);
  } else if (this.options.mongo) {
    this.collection.insert(message,function(err, docs) {
      if (err) {
        sys.puts(sys.inspect(err));
        callback({
          message: 'failed to insert message into mongodb',
          detail: err
        });
      } else {
        for (var i=0; i<docs.length; i++) {
          messages.push(docs[i]);
          sys.puts('Stored message ' + docs[i].id + ' at timestamp ' + docs[i].timestamp);
        }
        callback(error);
      }
    });
  } else {
    callback(error);
  }
};

Queue.prototype.dequeue = function(message, callback) {
  
};
