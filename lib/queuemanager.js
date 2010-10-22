var sys = require('sys'),
    Queue = require('./queue').Queue;

/**
 * QueueManager:
 *
 * A simple queue manager that returns a queue object by name.  If a named
 * queue does not exist, it is created
 */
var QueueManager = function(config, callback) {
  this.config = config || {};
  this.queues = {};
  callback(this);
};

QueueManager.prototype = {
  getQueue: function(queueName, callback) {
    if (!this.queues[queueName]) {
      this.queues[queueName] = new Queue(queueName, this.config, callback);
    } else {
      callback(this.queues[queueName]);
    }
  },
  listQueues: function(callback) {
    var queues = [];
    for (queue in this.queues) {
      queues.push(queue);
    }
    callback(queues);
  }
};

exports.QueueManager = QueueManager;