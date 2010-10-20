var QueueManager = function(config, callback) {
  config = config || {};
  
  this.queues = {};
};

QueueManager.prototype.get = function(queue) {
  if (!this.queues[queue]) {
    this.queues[queue] = new Queue(queue);
  }
  return this.queues[queue];
};



exports = QueueManager;