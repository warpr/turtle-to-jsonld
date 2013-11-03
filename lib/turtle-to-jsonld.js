/* -*- mode: Javascript -*-

turtle-to-jsonld
Copyright 2013 Kuno Woudt <kuno@frob.nl>

turtle-to-jsonld is licensed under copyleft-next version 0.3.0, see
LICENSE.txt for more information.

*/

var jsonld = require ('jsonld');
var n3 = require ('n3');

var literal = /^"(.*)"(@([a-zA-Z]+(-[a-zA-Z0-9]+)?)|\^\^<(.*)>)?$/;
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

    return self;
};

var compactFromTurtle = function (data, callback) {
    var turtle = Parser ();

    options = { rdfParser: turtle.rdfParser, useNativeTypes: true }
    jsonld.fromRDF (data, options, function (err, dataset) {
        if (err) {
            callback (err);
            return;
        }

        options = { optimize: true }
        jsonld.compact (dataset, turtle.context, options, function (err, compacted) {
            callback (null, compacted);
        });
    });
};

exports.term = term;
exports.fromTurtle = fromTurtle;
exports.compactFromTurtle = compactFromTurtle;
exports.version = require('../package').version;
exports.Parser = Parser;
