/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  var _ = require("lodash"),
    retool = require("./retool"),
    /**
     * @external ReMix
     * @see [ReMix Module](https://github.com/bline/remix)
     * @see [ReMix API](http://bline.github.io/remix/ReMix.html)
     */
    ReMix = require("remix").ReMix;

  /**
   * Construct a new Rule object
   * @class
   * @alias Rule
   * @param {...Rule~Argument}
   * @example
   *  var rule = new Rule('myRule', /\w+/);
   *  // or
   *  var rule = Rule('myRule', /\w+/);
   *  // or
   *  var rule = Rule('myRule').match(/\w+/);
   */
  function Rule() {
    if (!(this instanceof Rule))
      return Rule.create.apply(null, arguments);

    var args = _.toArray(arguments);

    /**
     * Actions for this rule.
     * @type {Lex~ActionCallback[]}
     */
    this.actions  = [];
    /**
     * [ReMix](http://bline.github.io/remix/ReMix.html) object for this rule.
     * @type {external:ReMix}
     * @see [ReMix](http://bline.github.io/remix/ReMix.html)
     */
    this.matcher  = new ReMix();
    /**
     * collection of specified non-composed matches
     * @type {external:ReMix~Template}
     * @see [ReMix~Template](http://bline.github.io/remix/ReMix.html#Template)
     */
    this.matches  = [];
    /**
     * collection of tokens returned from rule actions.
     * @type {Rule~Token[]}
     */
    this.tokens   = [];
    /**
     * Set to next sibling during composition for reject handling.
     * @type {?String}
     * @private
     */
    this.next     = null;
    /**
     * Unique id used to store namespace data on RegExp object (may remove this cludge later)
     * @private
     */
    this._id      = _.uniqueId('rule-');
    /**
     * Stores child {@link Rule}s
     * @private
     */
    this._rules   = [];
    /**
     * Current options.
     * @private
     */
    this._opt     = {};

    this.options(Rule.defaultOptions);

    /**
     * Each Rule stores a reference to the root for purposes
     * of namespace lookups and compositions.
     * @private
     */
    this._root     = this._linkRoot();

    /* Extract tokens first so we can resolve
     * our namespace before arguments are parsed and
     * possible child rules added.
     */
    var groups = _.groupBy(args, _.isString);
    this.tokens = groups['true'] || [];
    args = groups['false'] || [];
    this._resolveNamespace();
    this._parseArgs(args);
  }

  /**
   * @static
   * @see [ReMix](http://bline.github.io/remix/ReMix.html)
   */
  Rule.ReMix = ReMix;
  /**
   * Stores any registered [Rule Type API]{@link Rule#type}
   * @see {@link Rule#type}
   * @static
   * @private
   */
  Rule.types = {};
  /**
   * Register a {@link Rule~Type}
   * @param {String} name - name to register {@link Rule~Type} under.
   * @param {Rule~Type} proto - the prototype use to construct the {@link Rule~TypeAPI}.
   */
  Rule.registerType = function (name, proto) {
    Rule.types[name] = proto;
  };
  /**
   * Proxied to {@link external:ReMix.register}
   * @static
   * @see [ReMix.register](http://bline.github.io/remix/ReMix.html#register)
   */
  Rule.registerMatch = ReMix.register;
  /**
   * The default error handler, simply throws the given error.
   * @static
   * @type {Rule~ErrorCallback}
   */
  Rule.handleError = function (err) {
    throw err;
  };
  /**
   * The default action which is added to a rule during composition
   * if no actions have been setup. Disable by setting {@link Rule~Options.defaultAction}
   * to null.
   * @static
   * @type {Rule~ActionCallback}
   */
  Rule.defaultAction = function (yytext, match, namespace, tokens) {
    this.yytext = yytext;
    return tokens;
  };
  /**
   * Used to compose one rule inside another.
   * @private
   * @static
   * @param {Rule} dest - the Rule to compose into
   * @param {Rule} src - the Rule to compose from
   */
  Rule.composeRules = function (dest, src) {
    dest.scope(function () {
      var rule = dest.constructor.create.apply(dest.constructor, src.tokens)
        .action(src.actions)
        .match(src.matches);
      src.forEach(function (child) {
        dest.constructor.composeRules(rule, child);
      });
    });
  };
  /**
   * Simple static method for constructing new {@link Rule}s.
   * @param {...Rule~Argument} - Passed unchanged to {@link Rule}
   * @returns {Rule}
   */
  Rule.create = (function () {
    function R(args) {
      return Rule.apply(this, args);
    }
    R.prototype = Rule.prototype;
    return function () {
      return new R(arguments);
    };
  })();
  /**
   * Default options. Changing these will change the defaults for all future Rule objects.
   * @type {Rule~Options}
   */
  Rule.defaultOptions = {
    nsDelimiter: '.',
    exclusive: false,
    handleError: Rule.handleError,
    defaultAction: Rule.defaultAction,
    inheritable: ['nsDelimiter', 'handleError', 'defaultAction']
  };
  /**
   * Used for calling {@link Rule~SetupCallback} so that all rules
   * constructed can be parent correctly.
   * @param {Rule~SetupCallback} callback
   * @param {Array} args - Array of arguments.
   * @returns {*} Return of callback.
   */
  Rule.prototype.scope = function (callback, args) {
    var Klass = this.constructor,
      prevRule = Klass.currentRule, res;
    Klass.currentRule = this;
    res = callback.call(null, args || []);
    Klass.currentRule = prevRule;
    return res;
  };

  /**
   * Returns a constructed type {@link Rule~TypeAPI} object.
   * @param {String} type - The name of a registered Type.
   * @returns {Rule~TypeAPI}
   */
  Rule.prototype.type = function (type) {
    var Klass = this.constructor,
        proto = Klass.type[type];
    if (!proto)
      return this.handleError(new Error("invalid type " + type));
    if (_.has(proto, 'create') && _.isFunction(proto.create))
      proto.api = proto.create(this);

    if (proto.registerMatch)
      _.forEach(proto.registerMatch, function (spec, name) {
        Klass.registerMatch(name, spec);
      });

    var api = function (name, args) {
      if (_.isArray(name)) {
        args = name;
        name = null;
      }
      if (name)
        args = [name].concat(_.toArray(args));
      var rule = Klass.create.apply(null, args);
      rule._type = type;
      return rule;
    };
    api.rule = api;
    api.retool = retool;
    _.extend(api, proto.api);
    return api;
  };
  /**
   * Constructs a child {@link Rule} of the current {@link Rule}.
   * @param {...Rule~Argument}
   * @returns {Rule}
   */
  Rule.prototype.rule = function () {
    return this.scope(function (args) {
      return this.constructor.create.apply(null, this);
    }.bind(this), arguments);
  };
  /**
   * Set options.
   * @param {Rule~Options}
   */
  Rule.prototype.options = function (opt) {
    if (opt) {
      _.merge(this._opt, opt);
      this.handleError = this._opt.handleError;
      this.defaultAction = this._opt.defaultAction;
    }
    return this;
  };
  /**
   * Get option specified by name.
   *
   * @param {String} optName - name of option value to return.
   * @returns {*} option value
   */
  Rule.prototype.getOption = function (optName) {
    return this._opt[optName];
  };

  /**
   * Returns the parent of the current {@link Rule}.
   *
   * @returns {Rule}
   */
  Rule.prototype.parent = function () {
    return this._parent;
  };
  /**
   * Returns the root of all Rules which could possibly be the current Rule.
   *
   * @returns {Rule}
   */
  Rule.prototype.root = function () {
    return this._root;
  };
  /**
   * Adds arguments to the current Match collection.
   *
   * @param {...external:ReMix~Spec}
   * @returns {Rule}
   * @see [ReMix~Spec](http://bline.github.io/remix/ReMix.html#Spec)
   */
  Rule.prototype.match = function () {
    this.matches.push.apply(this.matches, arguments);
    return this;
  };
  /**
   * Called on the root Rule from within the lexer, you should never need to
   * call this unless you are writing another Lex class which uses this.
   * Resolves all namespaces, subrules and actions. After this is called,
   * everything should be ready for the lexer to extract the relevant bits.
   *
   * @returns {Rule}
   */
  Rule.prototype.compose = function () {
    this._resolveNamespaces();
    this._resolveMatcher();
    this._resolveActions();
    return this;
  };
  /**
   * This is used to resolve the namespace of sibling Rules. This is used when
   * processing {@link Rule} [compositions]{@link Rule~Composition}.
   *
   * @param {String} namespace - the namespace, or name if it's a sibling, to
   * resolve.
   * @returns {String} resolved namespace.
   * @see {@link Rule~Composition}.
   */
  Rule.prototype.resolveSiblingNS = function (ns) {
    var parentNS = this.resolveParentNS();
    var rns = parentNS ? [parentNS, ns].join(this._opt.nsDelimiter) : ns;
    if (!this._root.ns[rns])
      rns = ns;
    if (!this._root.ns[rns])
      return this.handleError(new Error('invalid namespace ' + ns));
    return rns;
  };
  /**
   * Returns the namespace which represents the current Rule. Rules without a
   * namespace use the first parent which has a namespace for purposes of
   * resolution.
   *
   * @returns {String} Resolved namespace of current Rule.
   */
  Rule.prototype.resolveNS = function () {
    var rule = this;
    while (rule && !rule.namespace)
      rule = rule._parent;
    return rule && rule.namespace;
  };
  /**
   * Similar to {@link Rule~resolveNS}, but resolves
   * the parent Rule's namespace.
   *
   * @returns {String} Resolved parent namespace of current Rule.
   */
  Rule.prototype.resolveParentNS = function () {
    var rule = this._parent;
    while (rule && !rule.namespace)
      rule = rule._parent;
    return rule && rule.namespace;
  };
  /**
   * Retrieves the Token name possibly suffixed by this Rule's Type. The Token
   * name is the first token specified when instanciating a {@link Rule} object.
   * The Rule's type is the identifier given to the {@link Rule~TypeAPI}. Type
   * only applies if this Rule was created using that API.
   *
   * @returns {String} This Rule's token name with possible type suffix.
   */
  Rule.prototype.tokenNamespace = function () {
    return this._type ?
      this.tokenName + this._opt.nsDelimiter + this._type :
      this.tokenName;
  };
  /**
   * Loop through all this rule's child rules.
   *
   * @param {Rule~ForEachCallback} func - function to call on each iteraction.
   * @param {*} ctx - Set the context.
   */
  Rule.prototype.forEach = function (func, ctx) {
    this._rules.forEach.apply(this._rules, arguments);
  };
  /**
   * Sets this Rule's actions to the arguments.
   *
   * @param {...Rule~ActionCallback} - Zero or more callbacks. If called with no
   * callbacked, all actions will be emptied.
   * @returns {Rule}
   */
  Rule.prototype.action = function (action) {
    this.actions = _.flatten(arguments);
    return this;
  };
  /**
   * Add action to the current list of actions for this rule. Actions happen
   * when a {@link Rule} matches. They generally change the Lexer state or
   * return Tokens, but actions can do anything.
   *
   * @param {Rule~ActionCallback} action - The action to add to this rules
   * actions.
   * @returns {Rule}
   */
  Rule.prototype.pushAction = function (action) {
    this.actions.push(action);
    return this;
  };
  /**
   * Just sets the current Rule's actions to a NOOP if boolean is true.
   *
   * @param {Boolean} bool - If true, ensure this rule's matches are skipped.
   * @returns {Rule}
   */
  Rule.prototype.skip = function (bool) {
    if (bool)
      this.action(_.noop);
    return this;
  };
  /**
   * Sets the current rule to be exclusive. This means it will not be included
   * in it's parent's rules. This is use for using {@link Rule~Composition} or
   * creating Rules which are only tested during certain Lexer states.
   *
   * @param {Boolean} bool - True if this Rule is exclusive.
   * @returns {Rule}
   */
  Rule.prototype.exclusive = function (bool) {
    this._opt.exclusive = bool;
    return this;
  };
  /**
   * Returns text indented.
   *
   * @param {Number} i - Number of spaces to indent.
   * @param {String} txt - The text to prepend indent.
   * @returns {String} text prepended with i spaces.
   * @private
   */
  function indent(i, txt) {
    var str = '';
    _.times(i, function () { str += ' '; });
    return str + txt;
  }
  /**
   * Very useful for debugging. Dumps the structures of the current Rule and all
   * children to the console.
   *
   * @returns {Rule}
   */
  Rule.prototype.dump = function (i) {
    i = i || 0;
    console.log(
      indent(
        i, (this.resolveNS() || '.') + ' /' + this.matcher.toString() + '/'));
    this.forEach(function (rule) {
      rule.dump(i + 1);
    });
    return this;
  };
  /**
   * Called from the constructor to either link the current Rule to it's parent
   * or set the current Rule to the Root Rule is no Root is found.
   *
   * @returns {Rule} root - The root Rule.
   * @private
   */
  Rule.prototype._linkRoot = function () {
    var parent = this.constructor.currentRule,
          root = parent ? parent._root ? parent._root : parent : this;
    if (root === this)
      this.ns = {};
    else
      parent._addRule(this);
    return root;
  };
  /**
   * Parents the given {@link Rule} into the current {@link Rule}. Set
   * inheritable options.
   *
   * @param {Rule} rule - Rule to parent.
   * @returns {Rule} The mutated rule which was passed in.
   * @private
   */
  Rule.prototype._addRule = function (rule) {
    this._rules.push(rule);
    rule._parent = this;
    rule.options(_.pick(this._opt, this._opt.inheritable));
    rule._type = this._type;
    return rule;
  };
  /**
   * Called from the constructor to parse/process the arguments. Process mean-
   * ing that {@link Rule~Composition} and {@link Rule~SetupCallback}'s are
   * done inline.
   *
   * @param {Rule~Argument[]} args - Arguments passed to the constructor as an
   * array.
   * @returns {Rule}
   * @private
   */
  Rule.prototype._parseArgs = function (args) {
    args.forEach(this._parseArg.bind(this));
    return this;
  };
  /**
   * Processes a single {Rule~Argument} based on it's type.
   *
   * @param {Rule~Argument} arg - The argument to process.
   * @returns {Rule}
   * @private
   */
  Rule.prototype._parseArg = function (arg) {
    if (_.isFunction(arg)) {
      this.scope(function () {
        arg.call(this, this.constructor);
      }.bind(this));
    } else if (_.isRegExp(arg))
      this.matches.push(arg);
    else if (_.isString(arg))
      this.tokens.push(arg);
    else if (_.isArray(arg))
      arg.forEach(this._composeRule.bind(this));
    else
      this.handleError(new Error("unknown type of argument"));
    return this;
  };
  /**
   * Composes the rule specified by `ns` argument into the current rule.
   *
   * @param {String} ns - namespace to compose.
   * @private
   */
  Rule.prototype._composeRule = function (ns) {
    var inclusive = true;
    if (ns[0] === '+' || ns[0] === '-') {
      inclusive = ns[0] === '+';
      ns = ns.slice(1);
    }
    var rns = this.resolveSiblingNS(ns);
    if (!rns)
      return this.handleError(new Error('invalid or not created yet ns ' + ns));
    var rule = this._root.ns[rns];
    if (inclusive)
      this.constructor.composeRules(this, rule);
    else
      rule.forEach(function (rule) {
        this.constructor.composeRules(this, rule);
      }, this);
  };

  /**
   * Called before the lexer obsorbs our actions. Sets this rules actions to
   * the default action if no rules are set and this rule has matches.
   * Recursives to child Rules.
   *
   * @returns {Rule}
   * @private
   */
  Rule.prototype._resolveActions = function () {
    if (!this.actions.length && this.defaultAction && this.matches.length)
      this.actions.push(this.defaultAction);
    this.forEach(function (rule) {
      rule._resolveActions();
    });
    return this;
  };

  /**
   * Recursive method which resolves this Rule's namespace and all sub-Rule
   * namespaces. This method is called during Rule construction.
   *
   * @returns {Rule}
   * @private
   */
  Rule.prototype._resolveNamespace = function () {
    var parent, sep = this._opt.nsDelimiter;

    /* XXX move to own method */
    if (!this.tokenName)
      this.tokenName = this.tokens[0];

    if (this.tokenName && (this.tokenName[0] === '+' || this.tokenName[0] === '-')) {
      this._opt.exclusive = this.tokenName[0] === '-';
      this.tokens[0] = this.tokenName = this.tokenName.slice(1);
    }

    if (!this.namespace && this.tokenName) {
      parent = this._parent;
      while (parent && !parent.namespace)
        parent = parent._parent;
      this.namespace = parent && parent.namespace ?
        parent.namespace + sep + this.tokenNamespace() :
        this.tokenNamespace();
    }

    var actualNS = this.namespace || this.tokenNamespace() || '.';
    if (this._root.ns[actualNS])
      return this.handleError(new Error('namespace conflict with ' + actualNS));
    this._root.ns[actualNS] = this;
    return this;
  };
  /**
   * Recursive method which sets up the {@link external:ReMix} objects
   * namespace during Rule composition.
   *
   * @returns {Rule}
   * @private
   * @see [ReMix#name](http://bline.github.io/remix/ReMix.html#name)
   */
  Rule.prototype._resolveNamespaces = function () {
    if (this.namespace) {
      this.matcher.name(this.tokenNamespace());
    }
    this.forEach(function (rule) {
      rule._resolveNamespaces();
    });
    return this;
  };
  /**
   * Recursive method which resolves the {@link external:ReMix} object's matches
   * based on the {@link Rule~Options.exclusive}ness of the child Rule.
   *
   * @private
   * @see [ReMix#clear](http://bline.github.io/remix/ReMix.html#clear)
   * @see [ReMix#add](http://bline.github.io/remix/ReMix.html#add)
   * @see [ReMix#options](http://bline.github.io/remix/ReMix.html#options)
   */
  Rule.prototype._resolveMatcher = function () {
    this.matcher.clear();
    this.matcher.add(this.matches);
    this.matcher.options({nsDelimiter: this._opt.nsDelimiter});

    var prev = null;
    this.forEach(function (rule) {
      rule._resolveMatcher();
      if (prev) {
        prev.next = rule.namespace || rule.tokenNamespace() || '.';
        rule.prev = prev.namespace || prev.tokenNamespace() || '.';
        prev = rule;
      } else {
        prev = rule;
      }
      if (!rule.getOption('exclusive') && rule.matcher && rule.matcher.hasSpecs()) {
        this.matcher.add(rule.matcher);
      }
    }.bind(this));
  };
  /**
   * Callback used for error handling.
   *
   * @callback Rule~ErrorCallback
   * @param {Error} error - The error object for the current uncaught exception.
   * @see {@link Rule~Options}
   * @see {@link Rule#options}
   */
  /**
   * Callback for setting up children. Any {@link Rule} constructed in this callback
   * will be parented by the Rule the callback was specified to.
   *
   * @callback Rule~SetupCallback
   * @param {Rule.constructor} - Use as function or constructor to create new child
   * {@link Rule}s
   * @this {Rule} - Use to configure the current {@link Rule}.
   * @see {@link Rule}
   */
  /**
   * Default options for all instances of {@link Rule} can be set by changing
   * {@link Rule.defaultOptions}. Per-instance options can be specified to
   * {@link Rule#options} which are merged with {@link Rule.defaultOptions}.
   *
   * @typedef {Object} Rule~Options
   * @property {String} nsDelimiter=. - The delimiter used for composing
   * namespaces.
   * @property {Boolean} exclusive=false - Indicated if this rule should be
   * composed into it's parent.
   * @property {Rule~ErrorCallback} handleError=Rule.handleError - Called for
   * any exceptions.
   * @property {Lex~ActionCallback} defaultAction=Rule.defaultAction - This
   * action is set as the Rule's only action if not action have been specified.
   * Set to null to disable default actions.
   * @property {String[]} inheritable=nsDelimiter,handleError,defaultAction -
   * List of attributes in [this object]{@link Rule~Options} which
   * should be set in children we are parenting.
   * @see {@link Rule#options}
   * @see {@link Rule.defaultOptions}
   */
  /**
   * If a {Rule~TypeAPI.create} property if set, it is called to construct
   * the prototype which extends the default API.
   *
   * @callback Rule~TypeCreateCallback
   * @param {Rule} rule - The current Rule.
   * @returns {Rule~Type}
   */
  /**
   * This specifies the Type API object which is used for extending
   * the current Ruleset with a Type.
   *
   * @typedef {Object} Rule~Type
   * @property {Rule~TypeCreateCallback} create - If specified, this will be called to create the API object.
   * @property {external:ReMix~Pairs} registerMatch - Key/value pairs to register as templates in {@link external:ReMix}.
   * @property {Object<String, Function>} api - Extends the final API. Provide type specific method here that mutate the
   * current Rule or create new sub-rules.
   * @see [ReMix~Pairs](http://bline.github.io/remix/ReMix.html#Pairs)
   */
  /**
   * This is the base API which is extended by any {@link Rule~Type.api}
   *
   * @callback Rule~TypeAPI
   * @param {String} [name] - Optional name for {@link Rule} construction.
   * @param {Array} args - Arguments to constructor for new {@link Rule}.
   * @returns {Rule}
   * @property {Rule~TypeAPI} rule - alias
   * @property {retool} retool
   */
  /**
   * Simple iteration callback, just proxied to Array.prototype.forEach..
   *
   * @callback Rule~ForEachCallback
   * @param {Rule} rule - Current Rule in `forEach` iteration.
   * @param {Number} index- Current index in `forEach` iteraction.
  /**
   * Tokens are returned up through the Lexer when this {@link Rule} matches.
   * The first token specified is considered the name of the current Rule.
   * If namespaces are enabled, each token is prefixed with the current name
   * stack.
   *
   * @typedef {String} Rule~Token
   */
  /**
   * Rules can compose other rules. The composition is done by specifying
   * an array of {@link Rule} namespaces. The namespaces given can be without
   * parent prefix if specifying a sibling {@link Rule}. All compositions happen inline,
   * this means the definition for the Rule being composed needs to happen first.
   *
   * Each composed Rule's children, actions Composing a rule takes all that rules children and actions
   *
   * Making a rule {@link Rule~Options.exclusive} and then composing it in multiple places
   * is the intent, however you may use composition however you like.
   *
   * @typedef {String[]} Rule~Composition
   */
  /**
   * {@link Rule} constructor takes unlimited number of arguments.
   * @typedef {(Rule~SetupCallback|RegExp|Rule~Token|Rule~Composition)} Rule~Argument
   */
  module.exports = Rule;
})();