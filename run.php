<?php
$port = 8003;
$node = '/usr/local/bin/node';
$queue = 'queue.js';
$queue_cmd = $node.' '.$queue;

while (true) {
  echo "launching queue server using '$queue_cmd'.\n";
  passthru($queue_cmd);
  sleep(1);
  $data = '';
  try {
    $h = fsockopen('localhost', $port);
    if ($h) {
      while($data = fread($h, 4096)) {
        $data += $data;
      }
      fclose($h);
      echo "received data:\n";
      echo $data."\n";
    } else {
      echo "no connection, waiting a moment ...\n";
      sleep(1);
    }
  } catch(Exception $e) {
    echo "caught exception:\n";
    print_r($e);
    sleep(1);
  }
}
?>