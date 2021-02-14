const crypto = require('crypto');
const querystring = require('querystring');
const https = require('https');

/** 
 * Escapes a URI string
 *
 * @method uriEscape
 * @param {String} string - the string to be escaped
 * @returns {String} an escaped URI string
 */
const uriEscape = (string) => {
    var output = encodeURIComponent(string);
    output = output.replace(/[^A-Za-z0-9_.~\-%]+/g, escape);
    output = output.replace(/[*]/g, function (ch) {
        return '%' + ch.charCodeAt(0).toString(16).toUpperCase();
    });

    return output;
};

/** 
 * Escapes a URI path string
 *
 * @method uriEscapePath
 * @param {String} string - the string to be escaped
 * @returns {String} an escaped URI path string
 */
const uriEscapePath = (string) => {
    var parts = [];
    string.split('/').forEach(part => {
        parts.push(uriEscape(part));
    });
    return parts.join('/');
};

/** 
 * Converts the given querystring parameters into an escaped and sorted string.
 *
 * @method queryParamsToString
 * @param {String || Array<Any>} params - the parameters to be escaped
 * @returns {String} an escaped URI path string
 */
const queryParamsToString = (params) => {
    var items = [];
    if (typeof params == 'string') {
        params = querystring.parse(params);
    }
    var sortedKeys = Object.keys(params).sort();

    sortedKeys.forEach(name => {
        var value = params[name];
        var ename = uriEscape(name);
        var result = ename + '=';
        if (Array.isArray(value)) {
            var vals = [];
            value.forEach(item => { vals.push(uriEscape(item)) });
            result = ename + '=' + vals.sort().join('&' + ename + '=');
        } else if (value !== undefined && value !== null) {
            result = ename + '=' + uriEscape(value);
        }

        items.push(result);
    });

    return items.join('&');
};

const generateSignature = (signingSecret, requestTimestamp, path, qs, body) => {
    let sigBasestring = `v0:${requestTimestamp}:${uriEscapePath(path || '/')}:${queryParamsToString(qs || '')}:${body || ''}`;
    let mySignature = `v0=${crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex')}`;
    return mySignature;
};

const getLocation = (href) => {
    var match = href.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);
    return match && {
        href: href,
        protocol: match[1],
        host: match[2],
        hostname: match[3],
        port: match[4],
        pathname: match[5],
        search: match[6],
        hash: match[7]
    }
}

const getOptions = (method, path, body) => {
    const now = new Date().getTime();
    const location = getLocation(`https://${process.env.CAPIDomain}${path}`);
    let qsObj = {};
    if (location.search) {
        qsObj = querystring.parse(location.search.substring(1));
    }

    const options = {
        hostname: process.env.CAPIDomain,
        port: 443,
        path: path,
        method: method,
        headers: {
            'content-type': 'application/json',
            'x-api-key': process.env.CAPIApiKey,
            'x-company-request-timestamp': now,
            'x-company-signature': generateSignature(process.env.CAPISigningSecret, now, location.pathname, qsObj, body)
        }
    };
    return options;
}


exports.get = (path) => {
    const options = getOptions('GET', path);
    return new Promise((resolve, reject) => {
        let body = '';
        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                console.log(`statusCode:${res.statusCode} path: ${path}` );
            }
            
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {                
                if (body && res.statusCode === 200) {
                    resolve(JSON.parse(body));
                } else {
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });
        req.end();
    })

}

exports.post = (path, body) => {
    const reqBody = JSON.stringify(body)

    const options = getOptions('POST', path, reqBody);

    options['Content-Length'] = reqBody.length;

    return new Promise((resolve, reject) => {
        let body = '';
        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                console.log(`statusCode:${res.statusCode} path: ${path}` );
            }
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {
                if (body && res.statusCode === 200) {
                    resolve(JSON.parse(body));
                } else {
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.log('Post Error', e);
            reject(e);
        });
        req.write(reqBody)
        req.end();
    })
}

exports.put = async (path, body) => {
    const reqBody = JSON.stringify(body)

    const options = getOptions('PUT', path, reqBody);

    options['Content-Length'] = reqBody.length;

    return new Promise((resolve, reject) => {
        let body = '';
        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                console.log(`statusCode:${res.statusCode} path: ${path}` );
            }
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {
                if (body && res.statusCode === 200) {
                    resolve(JSON.parse(body));
                } else {
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.log('Post Error', e);
            reject(e);
        });
        req.write(reqBody)
        req.end();
    })
}

exports.delete = (path) => {
    const options = getOptions('DELETE', path);
    return new Promise((resolve, reject) => {
        let body = '';
        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                console.log(`statusCode:${res.statusCode} path: ${path}` );
            }
            
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {                
                if (body && res.statusCode === 200) {
                    resolve(JSON.parse(body));
                } else {
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });
        req.end();
    })

}