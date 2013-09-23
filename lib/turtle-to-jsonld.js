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
            callback (err, null);
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
            var context = { "@context": parser._prefixes };
            var dataset = { "@default": triples };

            context_callback (null, context);
            dataset_callback (null, dataset);
        }
    });

    return null;
};

exports.term = term;
exports.fromTurtle = fromTurtle;
exports.version = require('../package').version;
exports.registerWith = function (jsonld) {
    var self = this;

    self.context = null;
    jsonld.registerRDFParser('text/turtle', function (input, callback) {

        fromTurtle (input, callback, function (err, context) {
            self.context = context;
        });

    });

    return self;
};

