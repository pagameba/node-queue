<?php
$h = fsockopen('localhost', 8126, $errno, $errstr);
while ($data = fread($h, 4096)) {
  $message .= $data;
}
fclose($h);
echo "message received: ".$message."\n\n";
?>