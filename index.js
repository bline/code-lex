 /*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  var Lex = module.exports.Lex = require('./lib');
  module.exports.retool = require('./lib/retool');
  module.exports.rule = require('./lib/rule');
  module.exports.lexer = function (opt) {
    return new Lex(opt);
  };
})();
