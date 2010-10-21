var sys = require('sys'),
    microseconds = require("../deps/node-microseconds/lib/node-microseconds");

var Queue = function(name, options, callback) {
  options = options || {};
  this.options = {
    maxconnections: options.maxconnections ? options.maxconnections : 5,
    locktimout: options.locktimeout ? options.locktimeout : 60,
    defaultpriority: options.defaultpriority ? options.defaultpriority : 2,
    maxlockcount: options.maxlockcount ? options.maxlockcount : 2
  };
  this.uniqueId = name;
  this.counter = 0;
  this.enqueued = 0;
  this.dequeued = 0;
  this.queues = {
    1: [], // high priority
    2: [], // normal priority
    3: []  // low priority
  };
  this.messages = {};
  this.lockedMessages = [];
  this.deadLetters = [];
  this.consumers = [];
  callback(this);
};

Queue.prototype = {
  clearLocks: function() {
    var now = microseconds.milliseconds();
    var timeout = this.options.locktimeout * 1000;
    for (var i=0; i<this.lockedMessages.length; i++) {
      var message = this.lockedMessages[i];
      if (now - message.locked > timeout) {
        //free lock
        this.lockedMessages.splice(i,1);
        message.locked = null;
        message.lock = null;
        message.lockCount ++;
        if (message.lockCount > this.options.maxlockcount) {
          this.removeMessageFrom(message, this.messages);
          this.deadLetters.push(message);
        } else {
          this.queues[message.priority].push(message);
        }
      }
    }
  },
  lockMessage: function(message) {
    sys.puts('Queue::lockMessage');
    message.lock = this.counter ++;
    message.locked = microseconds.milliseconds();
    this.lockedMessages.push(message);
  },
  nextId: function() {
    sys.puts('Queue::nextId');
    return this.uniqueId + '-' + (this.counter ++);
  },
  getMessage: function(id, withLock) {
    sys.puts('Queue::getMessage');
    this.clearLocks();
    var message = null;
    if (this.messages[id]) {
      if (this.messages[id].lock && withLock) {
        return message;
      }
      message = this.messages[id];
      if (withLock) {
        this.lockMessage(message);
        this.removeMessageFrom(message, this.queues[message.priority]);
      }
    }
    return message;
  },
  getNextMessage: function(withLock) {
    sys.puts('Queue::getNextMessage');
    this.clearLocks();
    var message, queue;
    for (var i=1; i<=3; i++) {
      queue = this.queues[i];
      for (var j=0; j<queue.length; j++) {
        if (!queue[j].lock) {
          message = queue[j];
          this.lockMessage(message);
          this.removeMessageFrom(message, queue);
          return message;
        }
      }
    }
    return null;
  },
  checkConsumers: function() {
    sys.puts('Queue::checkConsumers');
    if (this.consumers.length) {
      sys.puts('Queue::checkConsumers - there are ' + this.consumers.length);
      var message = this.getNextMessage();
      if (message) {
        sys.puts('Queue::checkConsumers - dispatching with message');
        var consumer = this.consumers.shift();
        consumer(200, message);
      }
    }
  },
  publish: function(message, priority, callback) {
    sys.puts('Queue::publish');
    priority = !isNaN(parseInt(priority)) ? parseInt(priority) : this.options.defaultpriority;
    priority = Math.min(3, Math.max(1, priority));
    var queue = this.queues[priority];
    var envelope = {
      id: this.nextId(),
      message: message,
      priority: priority,
      lock: null,
      added: microseconds.milliseconds(),
      locked: null,
      lockCount: 0
    };
    queue.push(envelope);
    this.messages[envelope.id] = envelope;
    callback(200, envelope);
    this.checkConsumers();
  },
  consume: function(id, options, callback) {
    sys.puts('Queue::consume');
    options = options || {};
    var block = options.blocking != undefined ? options.blocking : true;
    var lock = options.lock != undefined ? options.lock : true;
    var message;
    if (id) {
      message = this.getMessage(lock);
    } else {
      message = this.getNextMessage(lock);
    }
    if (!message) {
      sys.puts('Queue::consume - no message in the queue');
      if (block) {
        sys.puts('Queue::consume - blocking consumer');
        this.consumers.push(callback);
      } else {
        sys.puts('Queue::consume - not blocking consumer');
        callback(204, null);
      }
    } else {
      sys.puts('Queue::consume - returning message to consumer');
      callback(200, message);
    }
  },
  list: function(callback) {
    sys.puts('Queue::list');
    callback(200, {
      messages: this.messages
    });
  },
  stats: function(callback) {
    sys.puts('Queue::stats');
    callback(200, {
      messages: this.messages.length,
      consumers: this.consumers.length,
      enqueued: this.enqueued,
      dequeued: this.dequeued,
      deadLetters: this.deadLetters.length
    });
  },
  configure: function(options,callback) {
    sys.puts('Queue::configure');
    if (options) {
      for (option in options) {
        if (this.options[option]) {
          this.options[option] = options[option];
        }
      }
    }
    callback(200, {
      configuration: this.options
    });
  },
  flush: function(callback) {
    sys.puts('Queue::flush');
    this.queues[1] = [];
    this.queues[2] = [];
    this.queues[3] = [];
    this.lockedMessages = [];
    this.messages = {};
    for (var i=0; i<this.consumers.length; i++) {
      this.consumers[i](204,null);
    }
    callback(200, {});
  },
  deleteMessage: function(id, key, callback) {
    sys.puts('Queue::deleteMessage');
    var message,
        queue;
    if (this.messages[id]) {
      message = this.messages[id];
      if (!message.lock || (message.lock && message.lock == key)) {
        // go ahead and delete the message
        this.removeMessageFrom(message, this.queues[message.priority]);
        if (message.lock) {
          this.removeMessageFrom(message, this.lockedMessages);
        }
        this.removeMessageFrom(message, this.messages);
        callback(200, {'success':'Message was deleted'});
      } else {
        callback(403, {'error':'Invalid access.'});
      }
    } else {
      callback(404, {'error': 'Message not found.'});
    }
  },
  removeMessageFrom: function(message, queue) {
    sys.puts('Queue::removeMessageFrom');
    if (queue instanceof Array) {
      for (var i=0; i<queue.length; i++) {
        if (queue[i].id == message.id) {
          queue.splice(i, 1);
          return true;
        }
      }
    } else if (queue instanceof Object) {
      if (queue[message.id]) {
        return delete queue[message.id];
      }
    }
    return false;
  }
};

exports.Queue = Queue;