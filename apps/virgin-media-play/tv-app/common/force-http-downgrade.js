// Host in http://127.0.0.1:18782/common/

var WARN_ON_HTTPS = false;
var FORCE_HTTP_DOWNGRADE = true;
var HTTP_FORCED_PARAM = 'httpforced=1';
var isHttps = window.location.protocol === 'https:' ? true : false;
var httpForceWasTriedAlready = window.location.search.indexOf(HTTP_FORCED_PARAM) > -1 ? true : false;
var userAgent = navigator.userAgent.toLowerCase();
var isDesktop = userAgent.indexOf('windows') > -1 || userAgent.indexOf('macintosh') > -1 ? true : false;
var isEdge = userAgent.indexOf('edg') > -1 ? true : false;
var href = window.location.href;
var isHttpsClient = 
  href.indexOf("cid=sonyone") > -1 ||
  href.indexOf("cid=vmtv") > -1 ||
  href.indexOf("cid=dtheatre") > -1 ||
  href.indexOf("cid=greatplayer") > -1 ||
  href.indexOf("service=youview") > -1;
  
if (isHttpsClient && !isDesktop) FORCE_HTTP_DOWNGRADE = false;

// Try to force the user back to http, unless we tried that already
if (FORCE_HTTP_DOWNGRADE && isHttps && !httpForceWasTriedAlready) {
  var theHash = '#';
  var urlParts = window.location.href.split(theHash);
  var newUrl = 'http:' + urlParts[0].substring(window.location.protocol.length);
  newUrl += (newUrl.indexOf('?') === -1 ? '?' : '&') + HTTP_FORCED_PARAM;
  if (urlParts.length > 1) {
    newUrl += theHash + urlParts[1];
  }
  window.location.href = newUrl;
}

// Catch instances where the http downgrade failed (for desktop users only)
if (WARN_ON_HTTPS && FORCE_HTTP_DOWNGRADE && isHttps && httpForceWasTriedAlready && isDesktop && !isHttpsClient) {
  setTimeout(function() {
    var instructions = "see https://is.gd/iziwuk to set up MS Edge with 'Allow Insecure Content' for 'hybridtv.ss7.tv' to avoid this issue or test on a TV device.";
    var message = "Your browser may have incorrectly forced you to https. You can edit your browser's address bar, replacing 'https' with 'http'.";
    message += "\n\n";
    if (isEdge) {
      message += "However, since you are using MS Edge, " + instructions;
    } else {
      message += "Note that MS Edge is recommended for Hybrid TV, Chrome and Safari are not supported due to lack of configurability.";
      message += "\n\n";
      message += "Please " + instructions;
    }
    alert(message);
  }, 1000);
}
