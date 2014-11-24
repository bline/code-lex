/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  var Dex = module.exports.Dex = require('./lib/dex');
  module.exports.Match = require('./lib/match');
  module.exports.Register = module.exports.Match.register;
  module.exports.State = require('./lib/state');
  module.exports.StateBase = require('./lib/state-base');
  module.exports.dex = function (opt) {
    return new Dex(opt);
  };
})();
