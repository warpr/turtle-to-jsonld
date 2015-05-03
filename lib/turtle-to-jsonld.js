'use strict';
/* -*- mode: Javascript -*-

turtle-to-jsonld
Copyright 2013,2014 Kuno Woudt <kuno@frob.nl>

turtle-to-jsonld is licensed under Apache v2, see
LICENSE.txt for more information.

*/

var N3 = require ('n3');
var jsonld = require ('jsonld').promises;
var processContext = require ('jsonld').processContext;
var when = require ('when');
var _ = require ('underscore');

_.mixin(require('underscore.string').exports());

var term = function (str) {
    if (N3.Util.isBlank(str)) {
        return {
            type: 'blank node',
            value: str
        };
    } else if (N3.Util.isLiteral(str)) {
        var ret = {
            type: 'literal',
            value: N3.Util.getLiteralValue(str),
            datatype: N3.Util.getLiteralType(str),
        };

        var language = N3.Util.getLiteralLanguage(str);
        if (language !== '') {
            ret.language = language;
        }

        return ret;
    } else {
        return {
            type: 'IRI',
            value: str
        };
    }
};

var fromTurtle = function (input) {
    var deferred = when.defer ();

    var parser = new N3.Parser();
    var triples = [];
    parser.parse (input, function (err, triple) {
        if (err)
        {
            deferred.reject (err);
        }
        else if (triple)
        {
            triples.push ({
                subject: term (triple.subject),
                predicate: term (triple.predicate),
                object: term (triple.object)
            });
        }
        else
        {
            deferred.resolve({ '@context': parser._prefixes, '@default': triples });
        }
    });

    return deferred.promise;
};

var Parser = function () {
    var self = this;

    self.context = null;

    self.rdfParser = function (input) {
        return fromTurtle (input).then (function (result) {
            self.context = { '@context': result['@context'] };
            return { '@default': result['@default'] };
        });
    };
};

var walk = function (obj, key, list, action) {
    var _obj = _(obj);
    if (_obj.isArray () || _obj.isObject ())
    {
        _obj.each (function (val, key, list) {
            walk (val, key, list, action);
        });
    }

    action (obj, key, list);
};

var reorganize = function (root, compacted) {
    if (root == null || !compacted.hasOwnProperty('@graph')) {
        return compacted;
    }

    var rootNode = null;
    var otherNodes = {};

    var context = compacted['@context'];

    _(compacted['@graph']).each (function (val, key, list) {
        // FIXME: if val['@id'] is a CURIE (e.g. test:foo instead of
        // https://example.com/test/foo) the specified root needs to be in CURIE form as well
        if (val['@id'] === root) {
            rootNode = val;
        } else {
            otherNodes[val['@id']] = val;
        }
    });

    if (rootNode == null) {
        console.log('WARNING: root node', root, 'not found');
        return compacted;
    }

    walk (rootNode, null, null, function (val, key, list) {
        if (val.hasOwnProperty ('@id')
            && val['@id'] !== rootNode['@id']
            && otherNodes.hasOwnProperty (val['@id'])
        ) {
            list[key] = _(val).extend(otherNodes[val['@id']]);
            delete otherNodes[val['@id']];
            if (_(list[key]['@id']).startsWith('_:')) {
                delete list[key]['@id'];
            }
        } else if (
            otherNodes.hasOwnProperty (val)
                && context.hasOwnProperty (key)
                && context[key].hasOwnProperty ('@type')
                && context[key]['@type'] === '@id'
        ) {
            list[key] = otherNodes[val];
            delete otherNodes[val];
        } else if (
            _(val).isArray()
                && context.hasOwnProperty (key)
                && context[key].hasOwnProperty ('@type')
                && context[key]['@type'] === '@id'
        ) {
            var resolved = _(val).map(function (url, idx) {
                if (otherNodes.hasOwnProperty(url)) {
                    var copy = otherNodes[url];
                    delete otherNodes[url];
                    return copy;
                } else {
                    return url;
                }
            });

            list[key] = resolved;
        }
    });

    var remainingKeys = _(otherNodes).keys();
    if (remainingKeys.length > 0) {
        console.log('WARNING: could not resolve', remainingKeys.join(', '));
        return compacted;
    }

    return _({ '@context': compacted['@context'] }).extend (rootNode);
};


var compactFromTurtle = function (data, context, root) {
    var turtle = new Parser ();

    var options = { rdfParser: turtle.rdfParser, useNativeTypes: true };
    return jsonld.fromRDF (data, options).then(function (dataset) {
        if (context == null) {
            context = turtle.context;
        }

        options = { optimize: true, useNativeTypes: true };
        return jsonld.compact (dataset, context, options).then (function (compacted) {
            return reorganize (root, compacted);
        });
    });
};

var ntToTurtle = function (dataset, namespaces) {
    var deferred = when.defer ();
    var parser = new N3.Parser();
    var writer = new N3.Writer({ prefixes: namespaces });

    parser.parse(dataset, function(parseErr, triple) {
        if (parseErr) {
            deferred.reject (parseErr);
        } else if (triple) {
            writer.addTriple(triple);
        } else {
            writer.end(function (err, data) {
                if (err) {
                    deferred.reject (err);
                } else {
                    deferred.resolve (data);
                }
            });
        }
    });

    return deferred.promise;
};


var parseNamespaces = function (data) {
    var deferred = when.defer ();

    processContext (null, null, function (notused, initialContext) {
        processContext (initialContext, data, function (err, parsedContext) {
            if (err) {
                return deferred.reject (err);
            }

            var namespaces = {};
            Object.keys(parsedContext.mappings).forEach (function (key, idx, arr) {
                var value = parsedContext.mappings[key];
                if (value.reverse === false && value['@type'] === undefined && value['@id']) {
                    namespaces[key] = value['@id'];
                }
            });

            deferred.resolve (namespaces);
        });
    });

    return deferred.promise;
};


var fromJsonld = function (str) {
    var data = JSON.parse(str);

    return parseNamespaces(data).then (function (namespaces) {
        var options = { format: 'application/nquads' };
        return jsonld.toRDF (data, options).then(function (dataset) {
            return ntToTurtle(dataset, namespaces);
        });
    });
};

exports.term = term;
exports.fromTurtle = fromTurtle;
exports.fromJsonld = fromJsonld;
exports.compactFromTurtle = compactFromTurtle;
exports.version = require('../package').version;
exports.Parser = Parser;
