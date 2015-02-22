'use strict';
/* -*- mode: Javascript -*-

turtle-to-jsonld
Copyright 2013,2014 Kuno Woudt <kuno@frob.nl>

turtle-to-jsonld is licensed under copyleft-next version 0.3.0, see
LICENSE.txt for more information.

*/

var N3 = require ('n3');
var jsonld = require ('jsonld').promises;
var processContext = require ('jsonld').processContext;
var when = require ('when');

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

var compactFromTurtle = function (data, context) {
    var turtle = new Parser ();

    var options = { rdfParser: turtle.rdfParser, useNativeTypes: true };
    return jsonld.fromRDF (data, options).then(function (dataset) {
        if (context == null) {
            context = turtle.context;
        }

        options = { optimize: true, useNativeTypes: true };
        return jsonld.compact (dataset, turtle.context, options);
    });
};

var ntToTurtle = function (dataset, namespaces) {
    var deferred = when.defer ();
    var parser = new N3.Parser();
    var writer = new N3.Writer({ prefixes: namespaces });

    parser.parse(dataset, function(err, triple) {
        if (err) {
            deferred.reject (err);
        } else if (triple) {
            writer.addTriple(triple);
        } else {
            writer.end(function (data) {
                deferred.resolve (data);
            });
        }
    });

    return deferred.promise;
};


var parseNamespaces = function (data) {
    var deferred = when.defer ();

    processContext (null, null, function (_, initialContext) {
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
