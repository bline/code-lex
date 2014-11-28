/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  var _ = require("lodash"),
    util = require("util"),
    retool = require("./retool"),
    Re = require("remix").ReMix;

  Rule.defaultOptions = {
    nsDelimiter: '.',
    handleError: Rule.handleError
  };

  function Rule() {
    if (!(this instanceof Rule))
      return Rule.rule.apply(null, arguments);

    var args = _.toArray(arguments);

    this.actions  = [];
    this.matcher  = new Re();
    this.matches  = [];
    this.tokens   = [];

    this._root    = this._linkRoot();
    this._opt     = {};
    this._rules   = [];
    this._compose = [];

    this._compileArgs(args);

    this.handleError = this._opt.handleError;

  }
  Rule.types = {};
  Rule.registerType = function (name, proto) {
    Rule.types[name] = proto;
  };
  Rule.registerMatch = Re.register;
  Rule.handleError = function (err) {
    throw err;
  };
  Rule.prototype._linkRoot = function () {
    var parent = this.constructor.currentRule,
          root = parent ? parent._root ? parent._root : parent : this;
    if (root === this)
      this.ns = {};
    else
      parent.addRule(this);
    return root;
  };
  Rule.prototype.scope = function (callback, args) {
    var Klass = this.constructor,
     prevRule = Klass.currentRule, res;
    Klass.currentRule = this;
    res = callback.call(null, args || []);
    Klass.currentRule = prevRule;
    return res;
  };
  Rule.prototype.rule = function () {
    return this.scope(function (args) {
      return this.constructor.rule.apply(null, this);
    }.bind(this), arguments);
  };
  Rule.prototype.options = function (opt) {
    if (opt) {
      _.merge(this._opt, opt);
      this.matcher.options(opt);
    }
    return this._opt;
  };
  Rule.prototype._compileArgs = function (args) {
    var parseArg = function (arg) {
      if (_.isFunction(arg)) {
        this.scope(function () {
          arg.call(null, this);
        }.bind(this));
      } else if (_.isRegExp(arg))
        this.matches.push(arg);
      else if (_.isString(arg))
        this.tokens.push(arg);
      else if (_.isArray(arg))
        this._compose.push.apply(this._compose, arg);
      else
        this.handleError(new Error("unknown type of argument"));
    }.bind(this);
    args.forEach(parseArg);
  };

  Rule.prototype.parent = function () {
    return this._parent;
  };

  Rule.prototype.match = function () {
    this.matches.push.apply(this.matches, arguments);
    return this;
  };
  Rule.prototype.compose = function () {
    this.handleError = this._opt.handleError;
    if (!this.tokens.length || !this.matches.length)
      return this.handleError(new Error("no tokens or matches"));
    this.tokenName = this.tokens[0];

    this._resolveNamespaces();
    this._composeComposites();
    this._composeMatcher();
    return this;
  };

  Rule.prototype._resolveNamespaces = function () {

    var hasMatches = this.matches.length > 0, parent,
      sep = this._opt.nsDelimiter;
    /* root rule always has namespace */
    /* rules without matches, do not get a namespace */
    if (!this.namespace && (hasMatches || this._root === this)) {
      parent = this._parent;
      while (parent && !parent.namespace)
        parent = parent._parent;
      this.namespace = parent && parent.namespace ?
        parent.namespace + sep + this.tokenNamespace() :
        this.tokenNamespace();
    }
    if (this.namespace) {
      this.matcher.namespace(this.tokenNamespace());
      this.tokens = this.tokens.map(function (tag) {
        return this.namespace + sep + tag;
      }.bind(this));
    }
    this._root.ns[this.namespace || this.tokenNamespace()] = this;
    this._rules.forEach(function (rule) {
      rule._resolveNamespaces();
    });

    return this;
  };
  Rule.prototype._composeComposites = function () {
    this._compose.forEach(function (ns) {
      var rns = this.resolveNS(ns);
      if (!rns)
        return this.handleError(new Error('invalid namespace ' + ns));
      this.matcher.add(this._root.ns[rns].matcher);
    }.bind(this));
    return this;
  };
  Rule.prototype.resolveNS = function (ns) {
    var rule = this;
    while (rule && !rule.namespace)
      rule = rule._parent;
    return rule && rule.namespace;
  };
  Rule.prototype.addRule = function (rule) {
    this._rules.push(rule);
    rule._parent = this;
    rule.options(this._opt);
    rule._type = this._type;
    return rule;
  };
  Rule.prototype._composeMatcher = function () {
    this.forEach(function (rule) {
      rule._composeMatcher();
      if (rule.matcher && rule.matcher.hasSpecs())
        this.matcher.add(rule.matcher);
    }.bind(this));
  };
  Rule.prototype.tokenNamespace = function () {
    return this._type ?
      this.tokenName + this._opt.nsDelimiter + this._type :
      this.tokenName;
  };
  Rule.prototype.forEach = function (func, ctx) {
    this._rules.forEach.apply(this._rules, arguments);
  };

  Rule.prototype.token = function (token) {
    if (token) this.tokens.push(token);
    return this;
  };

  Rule.prototype.type = function (type) {
    var Klass = this.constructor,
        proto = Klass.type[type];
    if (!proto)
      return this.handleError(new Error("invalid type " + type));
    if (proto.hasOwnProperty('create'))
      proto.api = proto.create(this);

    if (proto.match)
      _.forEach(proto.match, function (spec, name) {
        Klass.registerMatch(name, spec);
      });

    var api = function (args) {
      var rule = Klass.rule.apply(null, args);
      rule._type = type;
      return rule;
    };
    api.rule = api;
    api.retool = retool;
    _.extend(api, proto.api);
    return api;
  };
  Rule.prototype.action = function (action) {
    this.actions = _.flatten(arguments);
    return this;
  };
  Rule.prototype.pushAction = function (action) {
    this.actions.push(action);
    return this;
  };
  Rule.prototype.skip = function (bool) {
    if (bool)
      this.action(_.noop);
    return this;
  };

  Rule.rule = (function () {
    function R(args) {
      return Rule.apply(this, args);
    }
    R.prototype = Rule.prototype;
    return function () {
      return new R(arguments);
    };
  })();
  module.exports = Rule;
})();