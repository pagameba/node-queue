var util = require('util'),
    microseconds = require("../deps/node-microseconds/lib/node-microseconds"),
    uuid = require("../deps/uuidjs/uuid");

/**
 * Queue:
 *
 * Implementation of a queue.
 */
var Queue = function(name, options, callback) {
  options = options || {};
  this.options = {
    maxconnections: options.maxconnections ? options.maxconnections : 5,
    locktimeout: options.locktimeout ? options.locktimeout : 60,
    defaultpriority: options.defaultpriority ? options.defaultpriority : 2,
    maxlockcount: options.maxlockcount ? options.maxlockcount : 2
  };
  
  this.name = name;
  
  // stats
  this.enqueued = 0;
  this.dequeued = 0;
  this.deleted = 0;
  
  // storage
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

  /**
   * Public API
   */
  publish: function(message, priority, callback) {
    priority = !isNaN(parseInt(priority,10)) ? parseInt(priority,10) : this.options.defaultpriority;
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
    this.enqueued ++;
    this.checkConsumers();
  },
  consume: function(id, options, callback) {
    options = options || {};
    var block = options.block != undefined ? options.block : true;
    var lock = options.lock != undefined ? options.lock : true;
    var message;
    if (id) {
      block = false;
      message = this.getMessage(lock);
    } else {
      message = this.getNextMessage(lock);
    }
    if (!message) {
      if (block) {
        this.consumers.push({
          lock: lock,
          callback: callback
        });
      } else {
        callback(204, '');
      }
    } else {
      this.dequeued ++;
      var t = message.timeout;
      delete message.timeout;
      callback(200, message);
      message.timeout = t;
    }
  },
  list: function(callback) {
    var obj = {
      messages: this.messages.length,
      queues: this.queues,
      locked: [],
      deadLetters: this.deadLetters
    };
    for (var i=0; i<this.lockedMessages.length; i++) {
      var locked = this.lockedMessages[i];
      obj.locked.push({
        id: locked.id,
        message: locked.message,
        priority: locked.priority,
        added: locked.added,
        locked: locked.locked,
        lockCount: locked.lockCount
      })
    }
    callback(200, obj);
  },
  stats: function(callback) {
    callback(200, {
      consumers: this.consumers.length,
      messages: this.queues[1].length + this.queues[2].length + this.queues[3].length,
      lockedMessages: this.lockedMessages.length,
      enqueued: this.enqueued,
      dequeued: this.dequeued,
      deleted: this.deleted,
      deadLetters: this.deadLetters.length
    });
  },
  configure: function(options,callback) {
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
    this.queues[1] = [];
    this.queues[2] = [];
    this.queues[3] = [];
    this.lockedMessages = [];
    this.messages = {};
    // disconnect waiting consumers gracefully with a 204 header (no content)
    for (var i=0; i<this.consumers.length; i++) {
      this.consumers[i](204,null);
    }
    callback(200, {});
  },
  clearDeadLetters: function(callback) {
    this.deadLetters = [];
    callback(200,{});
  },
  deleteMessage: function(id, lock, callback) {
    var message,
        queue;
    if (this.messages[id]) {
      message = this.messages[id];
      if (!message.lock || (message.lock && message.lock == lock)) {
        // go ahead and delete the message
        if (message.timeout) {
          clearTimeout(message.timeout);
        }
        this.removeMessageFrom(message, this.queues[message.priority]);
        if (message.lock) {
          this.removeMessageFrom(message, this.lockedMessages);
        }
        this.removeMessageFrom(message, this.messages);
        this.deleted ++;
        callback(200, {'success':'Message was deleted'});
      } else {
        callback(403, {'error':'Invalid access.'});
      }
    } else {
      callback(404, {'error': 'Message not found.'});
    }
  },
  
  removeConsumer: function(consumer) {
    for (var i=0; i<this.consumers.length; i++) {
      if (this.consumers[i].callback == consumer) {
        util.log('removing dead consumer');
        this.consumers.splice(i,1);
      }
    }
  },
  
/**
 * Private API
 */
   
  lockMessage: function(message) {
    message.lock = this.name + '-' + uuid.generate();
    message.locked = microseconds.milliseconds();
    
    // when locking, set a timeout to clear the lock
    // the timeout has to be cleared in deleteMessage
    var self = this;
    message.timeout = setTimeout(function() {
      util.log('lock timeout on message');
      delete message['timeout'];
      message.locked = null;
      message.lock = null;
      message.lockCount++;
      self.removeMessageFrom(message, self.lockedMessages);
      if (message.lockCount > self.options.maxlockcount) {
        self.removeMessageFrom(message, self.messages);
        self.deadLetters.push(message);
      } else {
        self.queues[message.priority].push(message);
      }
    }, this.options.locktimeout * 1000);
    this.removeMessageFrom(message, this.queues[message.priority]);
    this.lockedMessages.push(message);
  },
  nextId: function() {
    return this.name + '-' + uuid.generate();
  },
  getMessage: function(id, withLock) {
    var message = null;
    if (this.messages[id]) {
      if (this.messages[id].lock && !withLock) {
        return message;
      }
      message = this.messages[id];
      if (withLock) {
        this.lockMessage(message);
      }
    }
    return message;
  },
  getNextMessage: function(withLock) {
    var message, queue;
    for (var i=1; i<=3; i++) {
      queue = this.queues[i];
      for (var j=0; j<queue.length; j++) {
        if (!queue[j].lock) {
          message = queue[j];
          if (withLock) {
            this.lockMessage(message);
          }
          return message;
        }
      }
    }
    return null;
  },
  checkConsumers: function() {
    if (this.consumers.length) {
      var consumer = this.consumers.shift();
      var message = this.getNextMessage(consumer.lock);
      if (message) {
        this.dequeued ++;
        consumer.callback(200, message);
        this.checkConsumers();
      } else {
        this.consumers.push(consumer);
      }
    }
  },
  removeMessageFrom: function(message, queue) {
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