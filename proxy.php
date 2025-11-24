<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/xml; charset=utf-8');

$url = isset($_GET['url']) ? $_GET['url'] : '';
if (!$url || !preg_match('#^https?://#', $url)) { http_response_code(400); exit('Bad url'); }

$ctx = stream_context_create([
  'http' => ['timeout' => 15, 'header' => "User-Agent: EPG-Proxy\r\n"],
  'ssl'  => ['verify_peer' => true, 'verify_peer_name' => true],
]);
$xml = @file_get_contents($url, false, $ctx);
if ($xml === false) { http_response_code(502); exit('Upstream error'); }

echo $xml;
