<?php
$host = 'localhost';
$host = 'ec2-174-129-57-251.compute-1.amazonaws.com';
$port = 8002;

$h = fsockopen($host, $port, $errno, $errstr);
while ($data = fread($h, 4096)) {
  $message .= $data;
}
fclose($h);
echo "message received: ".$message."\n\n";
?>