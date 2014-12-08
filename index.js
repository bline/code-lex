 /*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  /**
   * @module
   */
  var Lex = module.exports.Lex = require('./lib');
  module.exports.retool = require('./lib/retool');
  module.exports.rule = require('./lib/rule');
  /**
   * Construct a new {@link Lex} object with given options.
   * @param {Lex~Options} opt - Specify {@link Lex} options.
   * @returns {Lex}
   * @see {@link Lex}
   * @example
   *  var lex = require('code-lex').lexer({
   *    handlerError: function (err) { throw err; }, // default
   *    diableNS: false // default
   *  });
   */
  module.exports.lexer = function (opt) {
    return new Lex(opt);
  };
})();
