<?php
// sample php script to publish a message to the queue

$host = 'http://localhost:8080/queue/';
// if run on the cmd line
$queue = $argv[1];
$message = $argv[2];
// if run via web server
if (isset($_REQUEST['queue'])) {
  $queue = $_REQUEST['queue'];
}
if (isset($_REQUEST['message'])) {
  $message = $_REQUEST['message'];
}
$request = $host.$queue.'/publish?message='.urlencode($message);
echo file_get_contents($request)."\n";
?>