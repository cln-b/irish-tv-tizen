/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-restricted-globals */

// Catastrophic app startup fail over
// Display error if app doesn't fully load in time [VMTV-367]
// Host in http://127.0.0.1:18782/common/
// If you update this file, check it with:
// npx es-check@9.2.0 es5 "common/**/*.js"

/**
 * Exit the app (delegates to new exitApp function if available)
 * Defaults to own implementation for cached/legacy apps.
 * @deprecated
 */
function exitApplication() {
  if (typeof window.exitApp === "function") return window.exitApp();

  // Fallback (remove only once all live versions have exitApp)

  // Samsung Tizen (if sandboxed apps use this script)
  if (typeof window.tizen !== "undefined") {
    try {
      // eslint-disable-next-line no-undef
      tizen.application.getCurrentApplication().exit();
      return;
    } catch (e) {}
  }

  // HbbTV (Freeview, VIDAA, YouView, etc)
  if (
    typeof window.appmgr !== "undefined" &&
    typeof window.appmgr.closeApplication !== "undefined"
  ) {
    try {
      window.appmgr.closeApplication();
      return;
    } catch (e) {}
  }

  // Generic exit mechanism
  window.open("", "_self");
  window.close();
  document.body.innerHTML = "";

  // Samsung Tizen fallback - navigate to OOM exit page
  setTimeout(function () {
    if (/tizen/i.test(navigator.userAgent))
      window.location.href = (window.vmRoot+"common/exit-app.html");
  }, 500);
}

function getQueryParam(name) {
  var search = window.location.search;
  var pairs;
  var i;
  var parts;
  var key;
  var value;

  if (!search || search.length < 2) return null;

  pairs = search.substring(1).split("&");

  for (i = 0; i < pairs.length; i++) {
    parts = pairs[i].split("=");
    key = decodeURIComponent(parts[0] || "");

    if (key === name) {
      value = parts.length > 1 ? parts.slice(1).join("=") : "";
      return decodeURIComponent(value);
    }
  }

  return null;
}

function addExitListeners(scope) {
  window.addEventListener("mousedown", function () {
    scope.exitApplication();
  });

  window.addEventListener("keydown", function (e) {
    var key = e.keyCode;
    if (key > 36 && key < 41) {
      window.keyPresses.push(key);

      // LEFT, RIGHT, UP, DOWN: reload app with debug on [PROD-3549]
      if (window.keyPresses.join(",").indexOf("37,39,38,40") > -1) {
        var url = location.href;
        url = url.split("#")[0];
        url += (url.indexOf("?") > -1 ? "&" : "?") + "debug=1";
        location.href = url;
      }
    } else {
      scope.exitApplication();
    }
  });
}

function showFatalError(title, bodyHtml, scope) {
  var message =
    '<div align="center" style="background:#181818; padding:25px; padding-bottom:40px; width:560px; margin:auto; margin-top:232px; border-radius:6px">';
  message += '<font face="sans-serif">';
  message += "<h2>";
  message += title;
  message += "</h2>";
  message += bodyHtml;
  message += "<br />";
  message +=
    '<span style="background:#808080; color:black; padding:10px; margin-bottom:20px; border-radius:6px">';
  message += "<strong>";
  message += "EXIT";
  message += "</strong>";
  message += "</span>";
  message += "</font>";
  message += "</div>";

  document.body.innerHTML = message;
  addExitListeners(scope);
}

// Check for missing params and start the load failure fallback timer
if (location.href.indexOf("overridestream") < 0) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  var scope = this;
  var loadingTimeLimit = 90000; // Give the device 1.5 minutes to finish loading the app
  var missingParams = [];
  window.keyPresses = [];

  // As an absolute minimum the app needs these params [GBN-1778]
  if (!getQueryParam("env")) missingParams.push("env");
  if (!getQueryParam("cid")) missingParams.push("cid");
  if (!getQueryParam("platform")) missingParams.push("platform");

  if (missingParams.length > 0) {
    showFatalError(
      "SORRY - COULD NOT START THE APP",
      "<h3>There seems to be a configuration problem.</h3>" +
        "<h3>Missing: " +
        missingParams.join(", ") +
        "</h3>" +
        "<h3>Please contact support.</h3>",
      scope
    );
  } else {
    window.loadFailureFallback = setTimeout(function () {
      showFatalError(
        "SORRY - COULD NOT ACCESS THE APP",
        "<h3>Either your device is not connected to the Internet, or you are not allowed to access this app from your region.</h3>",
        scope
      );
    }, loadingTimeLimit);
  }
}
