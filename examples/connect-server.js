var util = require('util'),
    path = require('path'),
    Connect = require('connect'),
    queue = require(path.join(__dirname, '../connect-queue')).queue;
    
var server = Connect.createServer(
  queue('/queue', {log:2})
);
server.listen(8080);