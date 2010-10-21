var http = require('http'),
    sys = require("sys"),
    url = require('url'),
    microseconds = require("./deps/node-microseconds/lib/node-microseconds"),
    EventEmitter = require('events').EventEmitter,
    mongo = require('./deps/node-mongodb-native/lib/mongodb'),
    mongo_host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? 
      process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost',
    mongo_port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? 
      process.env['MONGO_NODE_DRIVER_PORT'] : mongo.Connection.DEFAULT_PORT,
    LINE_SIZE = 120,
    emitter = new EventEmitter(),
    web_port = 8080;
    
/* TODO: put this into config.json */
var config = {
  web: {
    port: 8080
  },
  mongo: {
    host: mongoHost,
    port: mongoPort
  }
};

new QueueManager(config, function(queueManager) {
  http.createServer(function(request, response) {
    var parsed = url.parse(request.url, true);
    var pathComponents = parsed.pathname.split('/').splice(1);
    switch(request.method) {
      case 'GET':
        
        break;
      case 'PUT':
        break;
      case 'POST':
       break;
      case 'DELETE':
        break;
      default:
        
    }
  }).listen(config.web.port);
});

new Queue(options, function(queue) {
  var web = http.createServer(function(request,response){
    var parsed = url.parse(request.url, true),
        output = {
          success: false,
          message: 'Unknown error'
        },
        job;
    response.writeHead(200, {
      'Content-type':'text/json'
    });
    switch(parsed.pathname) {
      case '/push':
        if (parsed['query'] && parsed.query['message']) {
          sys.puts('got message via http: '+parsed.query.message);
          var ts = microseconds.milliseconds();
          job = {
            message: parsed.query.message,
            timestamp: ts
          };
          queue.enqueue(parsed.query.message, function(error) {
            
          });
          if (waiters.length) {

          } else {

          }
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
      case '/stats':
        output.success = true;
        output.waiters = waiters.length;
        output.messages = messages.length;
        response.end(sys.inspect(output));
        break;
      default:
        output.message = "Invalid request path "+request.pathname+", should be /push or /pull";
        response.end(sys.inspect(output));
    }
  }).listen(web_port);
  console.log('node-queue web server running on port ' + web_port);});
});


    
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


