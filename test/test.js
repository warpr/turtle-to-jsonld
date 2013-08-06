/* -*- mode: Javascript -*-

turtle-to-jsonld
Copyright 2013 Kuno Woudt <kuno@frob.nl>

turtle-to-jsonld is licensed under copyleft-next version 0.3.0, see
LICENSE.txt for more information.

*/

var parser = require('../lib/turtle-to-jsonld.js');
var assert = require('assert');

suite ('Parser', function () {
    suite ('Term', function () {

        test ('iri', function () {
            var term = parser.term ('https://example.com/iri/');
            assert.equal (term.type, 'IRI');
            assert.equal (term.value, 'https://example.com/iri/');
        });

        test ('blank node', function () {
            var term = parser.term ('_:example');
            assert.equal (term.type, 'blank node');
            assert.equal (term.value, '_:example');
        });

        test ('literal', function () {
            var term = parser.term ('"aap"');
            assert.equal (term.type, 'literal');
            assert.equal (term.value, 'aap');
            assert.equal (term.datatype, 'http://www.w3.org/2001/XMLSchema#string');
            assert.equal (term.language, undefined);
        });

        test ('literal with language tag', function () {
            var term = parser.term ('"aap"@fy-NL');
            assert.equal (term.type, 'literal');
            assert.equal (term.value, 'aap');
            assert.equal (term.datatype, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
            assert.equal (term.language, 'fy-NL');
        });

        test ('literal with datatype', function () {
            var term = parser.term ('"aap"^^<https://example.com/noot#mies>');
            assert.equal (term.type, 'literal');
            assert.equal (term.value, 'aap');
            assert.equal (term.datatype, 'https://example.com/noot#mies');
            assert.equal (term.language, undefined);
        });

    });

    suite ('Compact from turtle', function () {

        test ('no graph', function (done) {

            var input = [
                '@prefix dc: <http://purl.org/dc/terms/> .',
                '',
                '<https://example.com/titerito> dc:title "Titerito"@es .'
            ].join ("\n");

            var expected = {
                '@context': { 'dc': 'http://purl.org/dc/terms/' },
                '@id': 'https://example.com/titerito',
                'dc:title': {
                    '@language': 'es',
                    '@value': 'Titerito',
                }
            };

            parser.compactFromTurtle (input, function (err, result) {
                assert.equal (err, null);
                assert.deepEqual (result, expected);
                done ();
            });

        });

        test ('with graph', function (done) {

            var input = [
                '@prefix foaf: <http://xmlns.com/foaf/0.1/> .',
                '@prefix test: <https://example.com/ns#> .',
                '',
                'test:titerito foaf:maker test:farruko .',
                'test:farruko foaf:familyName "Reyes Rosado" .'
            ].join ("\n");

            var graph_to_hash = function (graph) {
                var ret = {};
                for (var idx in graph) {
                    var item = graph[idx];
                    ret[item['@id']] = item;
                };
                return ret;
            };

            parser.compactFromTurtle (input, function (err, result) {
                assert.equal (err, null);

                assert.deepEqual (result['@context'], {
                    'foaf': 'http://xmlns.com/foaf/0.1/',
                    'test': 'https://example.com/ns#'
                });

                var graph = graph_to_hash (result['@graph']);

                assert.deepEqual (graph['test:farruko'], {
                    '@id': 'test:farruko',
                    'foaf:familyName': 'Reyes Rosado'
                });

                assert.deepEqual (graph['test:titerito'], {
                    '@id': 'test:titerito',
                    'foaf:maker': { '@id': 'test:farruko' }
                });

                done ();
            });

        });
    });
});
