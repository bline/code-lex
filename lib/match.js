/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  /** @module parse/match */
  'use strict';
  var _ = require("lodash");
  var Match = module.exports = {};
  Match.registered = {
    hspace:          /[ \t\u00a0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000]/,
    noHspace:        /[^ \t\u00a0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000]/,
    vspace:          /[\v\n\r\f]/,
    number:          /0b[01]+|0o[0-7]+|0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?/,
    noVspace:        /[^\v\n\r\f]/,
    space:           /\s/,
    noSpace:         /\S/,
    word:            /\w/,
    noWord:          /\W/,
    eol:             /(?:\r\n?|\n|\f)/,
    notEol:          /[^\r\n\f]/,
    end:             /$/,
    begin:           /^/,
    backslashAny:    /\\(?:\\\\)*[\s\S]/,
    backslashLine:   /\\(?:\\\\)*./,
    regexEscapes:    /[.*+?^${}()|\[\]\/\\]/,
    cMultiComment:   /\/\*[^*]*\*+(?:[^\/*][^*]*\*+)*\//
  };
  Match.escape = function (str) {
    return str.replace(Match.render('(`regexEscapes`)'), "\\$1");
  };
  Match.register = function (identifier) {
    if (!_.isString(identifier)) {
      _.forEach(identifier, function(val, key) {
          if (!_.isString(key))
            throw new Error("invalid identifier for registerMatch '" + identifier + "'");
          Match.register(key, val);
      });
      return Match;
    }
    if (_.has(Match.registered, identifier))
      throw new Error(identifier + " already in use");

    Match.registered[identifier] = Match.render.apply(Match, _.toArray(arguments).slice(1));

    return Match;
  };
  Match.get = function (identifier) {
    return Match.registered[identifier];
  };
  Match.toSource = function () {
    if (_.isRegExp(arguments[0]) && arguments.length == 1)
      return arguments[0];

    var specs = _.toArray(arguments);
    var resolve = function (match, key) {
      if (!key)
        return match;
      var modMatch = /^\w+([+*?])$/.exec(key);
      if (modMatch)
        key = key.slice(0, -1);
      return (Match.registered[key] ?
        '(?:' + Match.registered[key].source + ')' :
          key)
            + (modMatch ? modMatch[1] : '');
    };
    var parse = function (spec) {
      if (_.isRegExp(spec))
        spec = '(?:' + spec.source + ')';
      else if (_.isString(spec)) {
        spec = resolve(spec, spec);
        spec = spec.replace(/(?:\\(?:\\\\)*`)|`\s*(\w+[+*?]?)\s*`/g, resolve);
      } else if (_.isArray(spec))
        spec = '(?:' + _.map(spec, parse).join('') + ')';
      else
        throw new Error('unknown spec "' + spec + '"');
      return spec;
    };
    return _.map(specs, parse).join('');
  };
  Match.prototype.toRegExp = function () {
    return new RegExp(Match.toSource.apply(Match, arguments));
  };
})();