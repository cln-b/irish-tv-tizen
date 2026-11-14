// Fetch these public boot files while WebKit parses the application bundles.
// Hand each response to its first normal caller, then leave subsequent requests
// alone. Account requests and catalogue/media URLs never enter this path.
(function () {
    var fetch = window.fetch;
    var pending = {};
    var files = [
        'https://www.rte.ie/wordpress/wp-content/uploads/standard/skyqsoip/config.json',
        'https://www.rte.ie/wordpress/wp-content/uploads/standard/skyqsoip/en_IE/label.json'
    ];
    files.forEach(function (url) {
        pending[url] = fetch(url, {credentials: 'omit'}).then(function (response) {
            return response.status === 200 ? response : null;
        }, function () { return null; });
    });
    window.fetch = function (input, options) {
        var url = typeof input === 'string' ? input : input && input.url;
        if (!Object.prototype.hasOwnProperty.call(pending, url)) {
            return fetch.apply(this, arguments);
        }
        var request = new Request(input, options);
        var hasHeaders = false;
        request.headers.forEach(function () { hasHeaders = true; });
        // Custom headers, cancellation and credentialed calls retain their normal
        // transport behaviour, including an already-aborted request's rejection.
        var signal = options && options.signal || typeof input !== 'string' && input.signal;
        if (request.method !== 'GET' || hasHeaders || signal ||
                request.credentials !== 'omit' ||
                options && (options.cache || options.mode || options.redirect)) {
            return fetch.apply(this, arguments);
        }
        var response = pending[url];
        delete pending[url];
        var receiver = this;
        var args = arguments;
        return response.then(function (result) {
            return result ? result : fetch.apply(receiver, args);
        });
    };
}());
