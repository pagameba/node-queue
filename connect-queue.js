var QueueManager = require('./lib/queuemanager').QueueManager,
    util = require('util'),
    url = require('url'),
    qm; 

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
  },
  'cleardeadletters': function(queue, pathComponents, query, content, callback) {
    queue.clearDeadLetters(callback);
  }
};

exports.queue = function(route, config) {
  // singleton instance of the queue manager
  if (!qm) {
    qm = new QueueManager(config);
  } else if (config){
    console.warn('queue was previously initialized, ignoring new config.');
  }
  if (!route || typeof route != 'string' || route.indexOf('/') != 0) {
    console.warn('Invalid route provided for queue, queue is not installed.');
    return function(req, res, next) {
      next();
    }
  }
  log('Initialized queue middleware for route ' + route);
  return function (request, response, next) {
    // Use the magic of closure on the response to handle outputting what
    // we want to send back to the user.  All methods are expected to send
    // an HTTP status code and some response which we will output as a
    // string and end the response.  We need to do it this way to conform
    // to the evented nature of nodejs.  It allows us to block a request
    // for a message until one becomes available (for instance).  Depending
    // on the type of obj, we will use (object) text/json or (string) 
    // text/plain for the content type of the response.
    var callback = function(status, obj) {
      var contentType = 'text/json; charset=utf-8',
          contentBody = '';
      status = status || 200;
      if (typeof obj == 'string') {
        contentType = 'text/plain; charset=utf-8';
        contentBody = obj;
      } else if (obj) {
        contentBody = JSON.stringify(obj);
      }
      if (query && query['callback']) {
        contentType = 'application/javascript';
        contentBody = query.callback+'('+contentBody+');';
      }
      response.writeHead(status, {
        'Content-type':contentType,
        'Content-length': contentBody.length
      });
      response.end(contentBody, 'utf-8');
      log( request.method + ': ' + opName + ' response: ' + status , contentBody);
    };
    // if next is not defined then this is not the connect framework so just fire a
    // 500 error since we don't know what to do.
    next = next || function(){
      callback(500,'Server was not able to handle your request.');
    };
    // is this request routed to the queue manager?
    if (request.url.indexOf(route) != 0) {
      return next();
    }
    var opName;
    // Okay, we got a request - parse it and figure out what the user is
    // actually asking for
    var parsed = url.parse(request.url, true);
    var query = parsed['query'] || {};
    var path = parsed.pathname.split(route).splice(1)[0];
    var pathComponents = path.split('/').splice(1);
    var queueName = pathComponents.shift();
    if (!queueName) {
      // just list the queues in this case
      qm.listQueues(function(queues){
        callback(200, queues);
      });
    } else {
      var content = '';
      // test to see if they have specified a queue.
      if (!queueName) {
        return next(new Error('You need to specify a named queue as the first element of the request path.'));
      } else {
        qm.getQueue(queueName, function(queue) {
          // default operation by request type
          opName = defaultOperations[request.method] || 'consume';
          // override operation if the next component of the path is an operation
          if (pathComponents.length && operations[pathComponents[0]]) {
            opName = pathComponents.shift();
          }
          var operation = operations[opName];
          log(request.method + ': ' + opName + ': ' + request.url);
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
          request.connection.on('error', function() {
            queue.removeConsumer(callback);
          });
          request.connection.on('timeout', function() {
            queue.removeConsumer(callback);
          });
          request.connection.on('end', function() {
            queue.removeConsumer(callback);
          });
        });
      }
    }
  }
}

function log(message, detail) {
  if (!qm || !qm.config || !qm.config.log) {
    return;
  } else if (qm.config.log == 1) {
    util.log(message);
  } else if (qm.config.log == 2) {
    if (detail) {
      message += ' : ' + detail;
    }
    util.log(message);
  }
}
