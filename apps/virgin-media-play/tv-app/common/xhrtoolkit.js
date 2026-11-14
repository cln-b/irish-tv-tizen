// ES5 compatible standalone XhrToolKit script
// Host in http://127.0.0.1:18782/common/

function XhrToolKit() { }

/**
 * Makes a GET request
 * @param {string} url Including any query params appended
 * @param {function} [success] Optional success callback (response will be passed)
 * @param {function} [failure] Optional failure callback (error object will be passed)
 * @param {object} [headers] Optional headers objects for the request
 */
XhrToolKit.getRequest = function (url, success, failure, headers) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);

  if (headers && typeof headers === "object") {
    for (var key in headers) {
      if (headers.hasOwnProperty(key)) {
        xhr.setRequestHeader(key, headers[key]);
      }
    }
  }

  xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {

        // SUCCESS
        var responseData = JSON.parse(xhr.responseText);
        success && success(responseData);

      } catch (error) {

        // PARSING ERROR
        var parsingErrorResponse = {
          error: {
            code: "JSON_PARSE_ERROR",
            message: error.message,
          },
        };
        console.error(parsingErrorResponse);
        failure && failure(parsingErrorResponse);

      }
    } else {

      // NETWORK ERROR
      var networkErrorResponse = {
        error: {
          code: "NETWORK_ERROR",
          message: "Request failed with status " + xhr.status,
        },
      };
      console.error(networkErrorResponse);
      failure && failure(networkErrorResponse);

    }
  };

  // ERROR EVENT
  xhr.onerror = function () {
    var networkErrorResponse = {
      error: {
        code: "NETWORK_ERROR",
        message: "Network error occurred",
      },
    };
    console.error(networkErrorResponse);
    failure && failure(networkErrorResponse);
  };

  xhr.send();
};

XhrToolKit.postRequest = function (url, body, success, failure, headers) {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);

  if (headers && typeof headers === "object") {
    for (var key in headers) {
      if (headers.hasOwnProperty(key)) {
        xhr.setRequestHeader(key, headers[key]);
      }
    }
  }

  xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        // SUCCESS
        var responseData = JSON.parse(xhr.responseText);
        success && success(responseData);
      } catch (error) {
        // PARSING ERROR
        var parsingErrorResponse = {
          error: {
            code: "JSON_PARSE_ERROR",
            message: error.message,
          },
        };
        console.error(parsingErrorResponse);
        failure && failure(parsingErrorResponse);
      }
    } else {
      // NETWORK ERROR
      var networkErrorResponse = {
        error: {
          code: "NETWORK_ERROR",
          message: "Request failed with status " + xhr.status,
        },
      };
      console.error(networkErrorResponse);
      failure && failure(networkErrorResponse);
    }
  };

  // ERROR EVENT
  xhr.onerror = function () {
    var networkErrorResponse = {
      error: {
        code: "NETWORK_ERROR",
        message: "Network error occurred",
      },
    };
    console.error(networkErrorResponse);
    failure && failure(networkErrorResponse);
  };

  xhr.send(JSON.stringify(body));
}

/**
 * Fetches an XML file and parses it into a Document object
 * @param {string} url 
 * @param {function} success 
 * @param {function} failure 
 */
XhrToolKit.fetchXML = function(url, success, failure) {
  var xhr = new XMLHttpRequest();

  xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(xhr.responseText, "text/xml");
        if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
          throw new Error("XML parsing error");
        }
        success(xmlDoc);
      } catch (error) {
        failure && failure(error);
      }
    } else {
      failure && failure({
        error: {
          code: xhr.status,
          message: xhr.statusText,
        },
      });
    }
  };

  xhr.onerror = function () {
    var networkErrorResponse = {
      error: {
        code: "NETWORK_ERROR",
        message: "Network error occurred",
      },
    };
    console.error(networkErrorResponse);
    failure && failure(networkErrorResponse);
  };

  xhr.open("GET", url, true);
  xhr.send();
}

window.XhrToolKit = XhrToolKit;
