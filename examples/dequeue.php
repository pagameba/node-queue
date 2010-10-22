<?php
// sample php script to consume a message from the queue

$host = 'http://localhost:8080/queue/';
// if run on the cmd line
$queue = $argv[1];

// if run via web server
if (isset($_REQUEST['queue'])) {
  $queue = $_REQUEST['queue'];
}
$request = $host.$queue;
echo "request: $request\n";
echo file_get_contents($request)."\n";
?>