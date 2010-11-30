/**
 * node-queue main event loop.
 *
 * Handle everything as a web request.  All queue operations are indentified
 * by the request pathname starting with /queue/ and are dispatched to the
 * appropriate Queue instance.
 */

var http = require('http'),
    util = require("util"),
    url = require('url'),
    fs = require('fs'),
    queue = require('./connect-queue').queue;


// we really want a config file to start with, fail if one is not provided
try {
  var config = JSON.parse(fs.readFileSync("./config.json"));

  // kick it all off by creating a queue manager and passing it our callback
  // to run a web server which dispatches requests to the appropriate queue
  // through the manager
  http.createServer(queue('/queue', config.queue)).listen(config.web.port);
  util.log("Queue running HTTP on port " + config.web.port);
  
  // Open a TCP port if so configured.  A client can connect to this port and
  // will be blocked as long as the server is running.
  if (config['tcp'] && 
      config.tcp['port'] && 
      config.tcp['host']) {
    require('net').createServer(function (stream) {
    }).listen(config.tcp.port, config.tcp.host);
    util.log("TCP running on " + config.tcp.host + ":" + config.tcp.port);
  }
} catch(e) {
  util.log(util.inspect(e));
  util.log("File config.json not found.  Try: `cp config.json.sample config.json`");
}