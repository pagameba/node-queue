<?php
$host = 'localhost';
$host = 'ec2-174-129-57-251.compute-1.amazonaws.com';
$port = 8081;

$message = $argv[1];
if (isset($_REQUEST['message'])) {
  $message = $_REQUEST['message'];
}
$h = fsockopen($host, $port, $errno, $errstr, 30);
fwrite($h, $message);
fclose($h);
?>