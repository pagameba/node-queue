var http = require('http'),
    sys = require("sys"),
    url = require('url'),
    QueueManager = require('./lib/queuemanager').QueueManager;
    
//    microseconds = require("./deps/node-microseconds/lib/node-microseconds"),
//    EventEmitter = require('events').EventEmitter,
//    mongo = require('./deps/node-mongodb-native/lib/mongodb'),
//    mongo_host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? 
//      process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost',
//    mongo_port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? 
//      process.env['MONGO_NODE_DRIVER_PORT'] : mongo.Connection.DEFAULT_PORT,
//    LINE_SIZE = 120,
    
/* TODO: put this into config.json */
var config = {
  web: {
    port: 8080
  }
};

var operations = {
  'list': function(queue, pathComponents, query, content, callback) {
    queue.list(callback);
  },
  'stats': function(queue, pathComponents, query, content, callback) {
    queue.stats(callback);
  },
  'configuration': function(queue, pathComponents, query, content, callback) {
    var config = content || query;
    queue.configure(config, callback);
  },
  'consume': function(queue, pathComponents, query, content, callback) {
    var messageId = pathComponents.length ? pathComponents.shift() : null;
    queue.consume(messageId, query, callback);
  },
  'publish': function(queue, pathComponents, query, content, callback) {
    var message = content || (query && query['message'] ? query.message : '');
    var priority = query && query['priority'] ? query.priority : queue.defaultPriority;
    queue.publish(message, priority, callback);
  },
  'flush': function(queue, pathComponents, query, content, callback) {
    queue.flush(callback);
  },
  'delete': function(queue, pathComponents, query, content, callback) {
    var messageId = query && query['id'] ? query.id : null;
    var deleteKey = query && query['deletekey'] ? query.deletekey : null;
    queue.deleteMessage(messageId, deleteKey, callback);
  }
};

// default operation names by request type.
var defaultOperations = {
  GET: 'consume',
  POST: 'publish',
  PUT: 'configuration',
  DELETE: 'flush'
};

// kick it all off by creating a queue manager and passing it our callback
// to run a web server which dispatches requests to the appropriate queue
// through the manager
new QueueManager(config, function(queueManager) {
  http.createServer(function(request, response) {
    sys.puts(request.method + ': ' + request.url);
    var parsed = url.parse(request.url, true);
    var query = parsed['query'] || {};
    var pathComponents = parsed.pathname.split('/').splice(1);
    var page = pathComponents.shift();
      var callback = function(status, obj) {
        var body = obj ? JSON.stringify(obj) : '';
        response.writeHead(status, {
          'Content-type':'text/plain; charset=utf-8',
          'Content-length':body.length
        });
        response.end(body, 'utf-8');
      };
    switch(page) {
      case 'queues':
        queueManager.listQueues(function(queues){
          callback(200, queues);
        });
        break;
      case 'queue':
        var queueName = pathComponents.shift();
        var content = '';
    
        if (!queueName) {
          var body404 = 'You need to specify a named queue as the first element of the request path.';
          response.writeHead(404, {
            'Content-type':'text/plain; charset=utf-8',
            'Content-length': body404.length
          });
          response.end(body404, 'utf-8');
        } else {
          queueManager.getQueue(queueName, function(queue) {
            // default operation by request type
            var operation = defaultOperations[request.method] || 'consume';
            // override operation if the next component of the path is an operation
            if (pathComponents.length && operations[pathComponents[0]]) {
              operation = pathComponents.shift();
            }
            // if the method includes content in the body of the request, read it
            // all and pass it to the operation, otherwise just do the operation
            // with no content (assuming that the operation can find its content
            // in the query object).
            if (request.method == 'PUT' || request.method == 'POST') {
              request.on('data', function(chunk) {
                content += chunk;
              });
              request.on('end', function() {
                operations[operation](queue, pathComponents, query, content, callback);
              });
            } else {
              operations[operation](queue, pathComponents, query, content, callback);
            }
          });
        }
        break;
      default:
        var body404 = 'Use /queue/<queue-name> to access a queue.';
        response.writeHead(404, {
          'Content-type':'text/plain; charset=utf-8',
          'Content-length': body404.length
        });
        response.end(body404, 'utf-8');
        break;
    }
  }).listen(config.web.port);
});
