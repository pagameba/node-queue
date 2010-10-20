var net = require('net'),
    http = require('http'),
    sys = require("sys"),
    url = require('url'),
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
    emitter = new EventEmitter(),
    host = 'localhost',
    web_port = 8080,
    push_port = 8081,
    pull_port = 8082,
    alive_port = 8083;

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
    net.createServer(function(stream) {}).listen(alive_port, host);
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
    push.listen(push_port, host);
    var pull = net.createServer(function(stream) {
      stream.on('connect', function(){
        if (messages.length) {
          message = messages.shift();
          collection.remove({_id: message._id}, function(err, collection) {});
          stream.end('{"success":true,message:'+message+'}');
          sys.puts('Dequeued message ' + message._id + ' at timestamp ' + message.timestamp);
        } else {
          waiters.push(stream);
        }
      });
      // stream.on('data', function(){});
      // stream.on('end', function(){});
    });
    pull.listen(pull_port, host);
    
    var web = http.createServer(function(request,response){
      var parsed = url.parse(request.url, true),
          output = {
            success: false,
            message: 'Unknown error'
          },
          message;
      response.writeHead(200, {
        'Content-type':'text/json'
      });
      switch(parsed.pathname) {
        case '/push':
          if (parsed['query'] && parsed.query['message']) {
            sys.puts('got message via http: '+parsed.query.message);
            var ts = microseconds.milliseconds();
            collection.insert({message:parsed.query.message, timestamp: ts},function(err, docs) {
              if (err) {
                sys.puts(sys.inspect(err));
                output.success = false;
                output.message = "failed to insert message.";
                output.detail = err;
                response.end(sys.inspect(output));
              } else {
                for (var i=0; i<docs.length; i++) {
                  messages.push(docs[i]);
                  sys.puts('Enqueued message ' + docs[i].id + ' at timestamp ' + docs[i].timestamp);
                }
                emitter.emit('message');
                output.success = true;
                output.message = "message enqueueued";
                output.id = ''+docs[0]._id;
                response.end(sys.inspect(output));
              }
            });
          } else {
            output.message = 'push requires message parameter';
            response.end(sys.inspect(output));
          }
          break;
        case '/pull':
          if (messages.length) {
            message = messages.shift();
            collection.remove({_id: message._id}, function(err, collection) {});
            output.success = true;
            output.message = message;
            response.end(sys.inspect(output));
            sys.puts('Dequeued message ' + message._id + ' at timestamp ' + message.timestamp);
          } else {
            waiters.push(response);
          }
          break;
        case '/list':
          output.success = true;
          output.message = messages;
          response.end(sys.inspect(output));
          break;
        default:
          output.message = "Invalid request path "+request.pathname+", should be /push or /pull";
          response.end(sys.inspect(output));
      }
    }).listen(web_port);
    console.log('Web Server running on port ' + web_port);

    
    emitter.on('message', function(){
      var output = {
        success: true,
        message: ''
      };
      if (messages.length && waiters.length) {
        stream = waiters.shift();
        message = messages.shift();
        collection.remove({_id: message._id}, function(err, collection) {});
        output.message = message;
        stream.end(sys.inspect(output));
        sys.puts('Dequeued message ' + message._id + ' at timestamp ' + message.timestamp);
      }
    });
  });
});


