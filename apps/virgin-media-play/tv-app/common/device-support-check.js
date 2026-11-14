/**
 * This script blocks certain devices/services from certain apps.
 * Ensure to include the Jira ticket number if adding conditions.
 * @host http://127.0.0.1:18782/common/
 */

(function () {
  var getProtocol = function () {
    var HTTP = "http:";
    var HTTPS = "https:";
    var PROTOCOL = location.protocol;
    return [HTTP, HTTPS].indexOf(PROTOCOL) > -1 ? PROTOCOL : HTTP;
  };

  /** @param {string} key */
  var getQueryParameterValue = function (key) {
    return (location.search.match(key + "=(.*?)(&|$)") || ["", ""])[1];
  };

  var customer = getQueryParameterValue("cid");
  var platform = getQueryParameterValue("platform");
  var launchType = getQueryParameterValue("lloc");
  var permittedDevice = getQueryParameterValue("permittedDevice") || true;
  var userAgent = navigator.userAgent.toLowerCase();
  var referrer = getQueryParameterValue("referrer");

  // [SONY-1775]
  var youviewBlockedDevices = ["t1000", "dn370t", "dn360t", "dn372t"];

  var isDashOrDRMSupportedYouviewDevice = function () {
    var deviceSupported = true;
    for (var i = 0; i < youviewBlockedDevices.length; i++) {
      if (userAgent.indexOf(youviewBlockedDevices[i]) > -1 && isYouView()) {
        deviceSupported = false;
        break;
      }
    }
    return deviceSupported;
  };

  var isFreeview = function () {
    return platform === "fvp";
  };

  var isYouView = function () {
    return userAgent.indexOf("youview") > -1;
  };

  var isLg = function () {
    return platform === "lg";
  };

  var isSamsung = function () {
    return userAgent.indexOf("tizen") > -1 || platform === "sam";
  };

  var isHuawei = function () {
    return userAgent.indexOf("huawei") > -1;
  };

  // [SONY-1807]
  var freeviewBlockedDevices = [
    "^.*fvc\\/3\\.0 \\(avtex;.*$",
    "^.*fvc\\/3\\.0 \\( ?cvte; ?fvp6586;.*$",
    "^.*fvc\\/1\\.0 \\(hisense;smarttv_2016;\\)$",
    "^.*fvc\\/1\\.0 \\(humax; fvp4000t;\\).*$",
    "^.*fvc\\/1\\.0 \\(panasonic;diga[.]{0,1}2015.*$",
    "^.*fvc\\/1\\.0 \\(panasonic;viera[.]{0,1}2015.*$",
    "^.*fvc\\/1\\.0 \\(panasonic;viera[.]{0,1}2016.*$",
    "^.*fvc\\/[23]\\.0 \\(tcl;.*$",
    "^.*fvc\\/[12]\\.0 \\((umc-sharp|sharp_umc);.*$",
    "^.*fvc\\/1\\.0 \\(.*; mb100;",
    "^.*fvc\\/1\\.0 \\(.*; mb110;",
    "^.*fvc\\/1\\.0 \\(.*; mb120;",
    "^.*fvc\\/1\\.0 \\(.*; t9110;",
  ];

  /** @param {string[]} blockedDeviceRegex */
  var isDeviceSupported = function (blockedDeviceRegex) {
    var include = true;
    include =
      /** @param {string} deviceRegEx */
      blockedDeviceRegex.filter(function (deviceRegEx) {
        var regX = new RegExp(deviceRegEx, "gm");
        var match = userAgent.match(regX);
        if (match && match.length) {
          return true;
        }
      }).length > 0
        ? false
        : true;
    return include;
  };

  var redirectUrl =
    getProtocol() +
    (window.vmRoot+"blockdevice/blockdevice.html?cid=") +
    customer;

  if (launchType.length > 0) redirectUrl = redirectUrl + "&lloc=" + launchType;

  if (referrer.length > 0) redirectUrl = redirectUrl + "&referrer=" + referrer;

  redirectUrl =
    redirectUrl + "&cachebuster=" + Math.random().toString().substring(2);

  // If this query param is passed, we should not need to check for CID
  // But, ensure blockedDevice image is present in S3 bucket for client
  if (permittedDevice && permittedDevice === "false")
    location.replace(redirectUrl);

  switch (customer) {
    case "greatplayer":
      // DRM/Dash unsupported on device [SONY-1775] [SONY-1733]
      /*
      if (
        !isDashOrDRMSupportedYouviewDevice() ||
        !isDeviceSupported(freeviewBlockedDevices)
      )
        location.replace(redirectUrl);
      */

      // [NAR-2552] Block all devices
      location.replace(redirectUrl);
      break;

    case "ketchup":
    case "yaaas":
    case "demand365":
      if (platform !== "fsat") location.replace(redirectUrl);

      break;

    case "sonykids":
      location.replace(redirectUrl);
      break;
  }

  // Sunsetted YouView Huawei unsupported
  if (isYouView() && isHuawei()) location.replace(redirectUrl);
})();
