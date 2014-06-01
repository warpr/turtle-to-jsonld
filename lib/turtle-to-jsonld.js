"use strict";
/* -*- mode: Javascript -*-

turtle-to-jsonld
Copyright 2013,2014 Kuno Woudt <kuno@frob.nl>

turtle-to-jsonld is licensed under copyleft-next version 0.3.0, see
LICENSE.txt for more information.

*/

var jsonld = require ('jsonld');
var n3 = require ('n3');

var literal = /^"([\s\S]*)"(@([a-zA-Z]+(-[a-zA-Z0-9]+)?)|\^\^<(.*)>)?$/;
var blanknode = /^_:/;

var term = function (str) {
    var parts = str.match (literal);
    if (parts)
    {
        var ret = {
            type: "literal",
            value: parts[1],
            datatype: parts[5] ? parts[5] :
                'http://www.w3.org/2001/XMLSchema#string'
        };

        if (parts[3])
        {
            ret.language = parts[3];
            ret.datatype = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
        }

        return ret;
    }
    else
    {
        return {
            type: str.match (blanknode) ? "blank node" : "IRI",
            value: str
        };
    }
};

var fromTurtle = function (input, dataset_callback, context_callback) {
    var parser = new n3.Parser();
    var triples = [];
    parser.parse (input, function (err, triple) {
        if (err)
        {
            dataset_callback (err, null);
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
            context_callback (null, { "@context": parser._prefixes });
            dataset_callback (null, { "@default": triples });
        }
    });

    return null;
};

var Parser = function () {
    var self = this;

    self.context = null;

    self.rdfParser = function (input, callback) {
        fromTurtle (input, callback, function (err, context) {
            self.context = context;
        });
    };
};

var compactFromTurtle = function (data, callback) {
    var turtle = new Parser ();

    var options = { rdfParser: turtle.rdfParser, useNativeTypes: true };
    jsonld.fromRDF (data, options, function (err, dataset) {
        if (err) {
            callback (err);
            return;
        }

        options = { optimize: true };
        jsonld.compact (dataset, turtle.context, options, function (err, compacted) {
            callback (null, compacted);
        });
    });
};

var ntToTurtle = function (dataset, namespaces, callback) {
    var parser = new n3.Parser();
    var writer = new n3.Writer(namespaces);

    parser.parse(dataset, function(err, triple) {
        if (err) {
            callback (err, null);
        } else if (triple) {
            writer.addTriple(triple);
        } else {
            writer.end(callback);
        }
    });
};


var parseNamespaces = function (data, callback) {
    jsonld.processContext (null, null, function (_, initialContext) {
        jsonld.processContext (initialContext, data, function (err, parsedContext) {
            if (err) {
                return callback (err, null);
            }

            var namespaces = {};
            Object.keys(parsedContext.mappings).forEach (function (key, idx, arr) {
                var value = parsedContext.mappings[key];
                if (value.reverse === false && value['@type'] === undefined && value['@id']) {
                    namespaces[key] = value['@id'];
                }
            });

            callback (null, namespaces);
        });
    });
};


var fromJsonld = function (str, callback) {
    var data = JSON.parse(str);

    parseNamespaces(data, function (err, namespaces) {
        if (err) {
            return callback (err);
        }

        var options = { format: 'application/nquads' };
        jsonld.toRDF (data, options, function (err, dataset) {
            if (err) {
                return callback (err);
            }

            ntToTurtle(dataset, namespaces, callback);
        });
    });
};

exports.term = term;
exports.fromTurtle = fromTurtle;
exports.fromJsonld = fromJsonld;
exports.compactFromTurtle = compactFromTurtle;
exports.version = require('../package').version;
exports.Parser = Parser;
