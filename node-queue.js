/**
 * node-queue main event loop.
 *
 * Handle everything as a web request.  All queue operations are indentified
 * by the request pathname starting with /queue/ and are dispatched to the
 * appropriate Queue instance.
 */

var http = require('http'),
    sys = require("sys"),
    url = require('url'),
    fs = require('fs'),
    QueueManager = require('./lib/queuemanager').QueueManager;

// Various operations that can happen on a queue.  We figure out which
// default operation we should be doing based on the request method then
// see if the next part of the path is actually an operation.  

// default operation names by request type.
var defaultOperations = {
  GET: 'consume',
  POST: 'publish',
  PUT: 'configuration',
  DELETE: 'flush'
};

// Operations are routed to the queue via a function lookup here.  This is
// just to make the code more readable (at least for me).
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
    var id = pathComponents.length ? pathComponents.shift() : null;
    queue.consume(id, query, callback);
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
    var id = query && query['id'] ? query.id : null;
    var lock = query && query['lock'] ? query.lock : null;
    queue.deleteMessage(id, lock, callback);
  }
};

// we really want a config file to start with, fail if one is not provided
try {
  var config = JSON.parse(fs.readFileSync("./config.json"));

  // kick it all off by creating a queue manager and passing it our callback
  // to run a web server which dispatches requests to the appropriate queue
  // through the manager
  new QueueManager(config.queue, function(queueManager) {
    http.createServer(function(request, response) {
      // Okay, we got a request - parse it and figure out what the user is
      // actually asking for
      var parsed = url.parse(request.url, true);
      var query = parsed['query'] || {};
      var pathComponents = parsed.pathname.split('/').splice(1);
      var page = pathComponents.shift();
      // Use the magic of closure on the response to handle outputting what
      // we want to send back to the user.  All methods are expected to send
      // an HTTP status code and some response which we will output as a
      // string and end the response.  We need to do it this way to conform
      // to the evented nature of nodejs.  It allows us to block a request
      // for a message until one becomes available (for instance).  Depending
      // on the type of obj, we will use (object) text/json or (string) 
      // text/plain for the content type of the response.
      var callback = function(status, obj) {
        var contentType = 'text/json; charset=utf-8';
        status = status || 200;
        if (typeof obj == 'string') {
          contentType = 'text/plain; charset=utf-8';
        } else {
          obj = obj ? JSON.stringify(obj) : '';
        }
        response.writeHead(status, {
          'Content-type':contentType,
          'Content-length': obj.length
        });
        response.end(obj, 'utf-8');
      };
      // Decide if we are dispatching an operation to a queue or serving some
      // other web request.
      switch(page) {
        case 'queues':
          queueManager.listQueues(function(queues){
            callback(200, queues);
          });
          break;
        case 'queue':
          var queueName = pathComponents.shift();
          var content = '';
          // test to see if they have specified a queue.  Perhaps the RESTful
          // way to handle this would be to list the queues here rather than using
          // /queues ?
          if (!queueName) {
            callback(404, 'You need to specify a named queue as the first element of the request path.');
          } else {
            queueManager.getQueue(queueName, function(queue) {
              // default operation by request type
              var opName = defaultOperations[request.method] || 'consume';
              // override operation if the next component of the path is an operation
              if (pathComponents.length && operations[pathComponents[0]]) {
                opName = pathComponents.shift();
              }
              var operation = operations[opName];
              // if the method includes content in the body of the request, read it
              // all and pass it to the operation, otherwise just do the operation
              // with no content (assuming that the operation can find its content
              // in the query object).
              if (request.method == 'PUT' || request.method == 'POST') {
                request.on('data', function(chunk) {
                  content += chunk;
                });
                request.on('end', function() {
                  operation(queue, pathComponents, query, content, callback);
                });
              } else {
                operation(queue, pathComponents, query, content, callback);
              }
            });
          }
          break;
        default:
          callback(404, 'Use /queue/<queue-name> to access a queue.');
          break;
      }
    }).listen(config.web.port);
    sys.puts("Queue running HTTP on port " + config.web.port);
  });
} catch(e) {
  sys.puts(sys.inspect(e));
  sys.log("File config.json not found.  Try: `cp config.json.sample config.json`");
}

