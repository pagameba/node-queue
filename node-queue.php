<?php
$message = $argv[1];
$h = fsockopen('localhost', 8125, $errno, $errstr, 30);
fwrite($h, $message);
fclose($h);
?>