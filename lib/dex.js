/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
  /**
   *  state('CoffeeScript', function () {
   *    code('singleQ');
   *    state('evalBegin', /#{/)
   *      .stricky()
   *      .end('evalEnd', /}/)
   *      .only(['trippleDQ', 'trippleSQ', 'trippleRE']);
   *    state('trippleDQ', /\"\"\"/).join(true);
   *    state('trippleSQ', /\'\'\'/).join(true);
   *    state('trippleRE', /\/\/\//).join(true);
   *    LineComment('#')
   *    MultiComment(/^###[\s\S]*?^[ \t]*###(\s|$)/m);
   *    Operator(/(?:[\-=]>|[\-+*\/%<>&|\^!?=]=|>>>=?|([\-+:])\1|([&|<>*\/%])\2=?|\?(?:\.|::)|\.{2,3})/);
   *    Identifier([
   *    ]);
   *  });
   */
(function () {
  'use strict';
  var _ = require('lodash'),
    State = require("./state"),
    StateBase = require("state-base"),
    util = require("util");

  Dex.defaultOptions = {};
  function Dex(opt) {
    StateBase.call(this);
    this._opt = _.extend({}, Dex.defaultOptions, opt);
    this._activeStates = [];
    this.tokens = [];
  }
  util.inherits(Dex, StateBase);

  Dex.prototype.setState = function (tag) {
    _.forEach(this._states, function (state) {
      if (state.hasTag(tag))
        this._activeStates.push(state);
    });
  };

  Dex.prototype.lex = function () {
    if (!this._activeStates.length)
      return this.emit('error', new Error("no active states. call setState first."));

    if (this.tokens.length) return this.tokens.shift();


  };
  module.exports = Dex;
})();
