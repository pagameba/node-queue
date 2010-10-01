var net = require('net'),
    http = require('http'),
    sys = require("sys"),
    microseconds = require("./deps/node-microseconds/lib/node-microseconds"),
    EventEmitter = require('events').EventEmitter,
    mongo = require('./deps/node-mongodb-native/lib/mongodb'),
    host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? 
      process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost',
    port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? 
      process.env['MONGO_NODE_DRIVER_PORT'] : mongo.Connection.DEFAULT_PORT,
    LINE_SIZE = 120,
    db = new mongo.Db('node-mongo-queue', new mongo.Server(host, port, {}), {}),
    messages = [],
    waiters = [],
    emitter = new EventEmitter();

sys.puts("Connecting to " + host + ":" + port);

db.open(function(err,db) {
  var collection = db.collection('node-queue', function(err, collection) {
    collection.find(function(err, cursor) {
      cursor.each(function(err, item) {
        if(item != null) {
          messages.push(item);
          sys.puts('Added message with id ' + item._id + ' to queue.');
        }
      });
    });
    net.createServer(function(stream) {}).listen(8124);
    var push = net.createServer(function(stream) {
      var message = '';
      // stream.setEncoding('utf8');
      // stream.on('connect', function(){ });
      stream.on('data', function(data) { message += data; });
      stream.on('end', function() {
        // insert message into database
        var ts = microseconds.milliseconds();
        collection.insert({message:message, timestamp: ts},function(err, docs) {
          if (err) {
            sys.puts(sys.inspect(err));
          } else {
            for (var i=0; i<docs.length; i++) {
              messages.push(docs[i]);
              sys.puts('Enqueued message ' + docs[i]._id + ' at timestamp ' + docs[i].timestamp);
            }
            emitter.emit('message');
          }
        });
      });
    });
    push.listen(8125,'localhost');
    var pull = net.createServer(function(stream) {
      stream.on('connect', function(){
        if (messages.length) {
          message = messages.shift();
          collection.remove({_id: message._id}, function(err, collection) {});
          stream.write(message.message);
          stream.end();
        } else {
          waiters.push(stream);
        }
      });
      // stream.on('data', function(){});
      // stream.on('end', function(){});
    });
    emitter.on('message', function(){
      if (messages.length && waiters.length) {
        stream = waiters.shift();
        message = messages.shift();
        collection.remove({_id: message._id}, function(err, collection) {});
        stream.write(message.message);
        stream.end();
      }
    });
    pull.listen(8126,'localhost');
  });
});

/*
http.createServer(function(request,response){
  response.writeHead(200, {
    'Content-type':'text/plain'
  });
  response.end('Hello World\n');
}).listen(8124);
console.log('Server running at http://localhost:8124/');

var net = require('net');
var server = net.createServer(function(stream) {
  stream.setEncoding('utf8');
  stream.on('connect', function(){
    stream.write('hello\r\n');
  });
  stream.on('data', function(data) {
    stream.write(data);
  });
  stream.on('end', function() {
    stream.write('goodbye\r\n');
  });
});
server.listen(8125,'localhost');
*/