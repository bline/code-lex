/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
/* jshint undef: true, unused: true */
/* global describe:false, it: false, beforeEach: false, expect */
(function () {
  "use strict";
  describe("rule#interface", function () {
    beforeEach(function () {
      this.clex = require("../index.js");
      this.rule = this.clex.rule;
    });
    describe("options", function () {
      beforeEach(function () {
        this.defAction = function () {};
        this.sep = ":";
        this.optrule = this.rule();
        this.optrule.options({
          defaultAction: this.defAction,
          nsDelimiter: this.sep
        });
      });
      it("should set defaults", function () {
        var rule = this.rule();
        rule._opt.nsDelimiter.should.be.equal(this.rule.defaultOptions.nsDelimiter);
        rule._opt.defaultAction.should.be.equal(this.rule.defaultAction);
        rule.defaultAction.should.be.equal(this.rule.defaultAction);
      });
      it("should set defaultAction", function () {
        this.optrule.defaultAction.should.be.equal(this.defAction);
      });
      it("should set nsDelimiter", function () {
        this.optrule._opt.nsDelimiter.should.be.equal(this.sep);
      });
    });
    describe("type", function () {
      it("should construct registered type", function () {
        var fooCalled = false;
        this.rule.registerType('foo', {
          api: {
            foo: function () {
              fooCalled=true;
              return 'foo';
            }
          }
        });
        var typedRule = this.rule.type('foo');
        typedRule.foo.should.be.a('function');
        typedRule.foo().should.be.equal('foo');
        fooCalled.should.be.equal(true);
        typedRule.rule.should.equal(typedRule);
        typedRule.retool.should.be.a('object');
        var rule = typedRule('foo', /foo/);
        rule._type.should.be.equal('foo');
        rule.tokenNamespace().should.be.equal('foo.foo');
        this.rule.types.foo = null;
      });
      it("should construct registered type with registerMatch", function () {
        var fooCalled = false;
        var re = /foo/;
        this.rule.registerType('foo', {
          registerMatch: {
            foo: re
          },
          api: {
            foo: function () {
              fooCalled=true;
              return 'foo';
            }
          }
        });
        this.rule.type('foo');
        this.rule.ReMix.registered.foo.should.be.equal(re);
        this.rule.ReMix.registered.foo = null;
        this.rule.types.foo = null;
      });
      it("should return null for unregistered", function () {
        expect(this.rule.type('foo')).to.be.null();
      });
      it("should construct api with create()", function () {
        var fooCalled = false;
        this.rule.registerType('foo', {
          create: function (rule) {
            rule.should.be.equal(this.rule);
            return {
              foo: function () {
                fooCalled=true;
                return 'foo';
              }
            };
          }.bind(this)
        });
        var typedRule = this.rule.type('foo');
        typedRule.foo.should.be.a('function');
        typedRule.foo().should.be.equal('foo');
        fooCalled.should.be.equal(true);
        var rule = typedRule('foo', /foo/);
        rule._type.should.be.equal('foo');
        rule.tokenNamespace().should.be.equal('foo.foo');
        this.rule.types.foo = null;
      });
    });
    describe("compose", function () {
      beforeEach(function () {
        this.simpleRule = this.rule('foo').compose();
        this.ruleWithRule = this.rule('foo', function (rule) {
          this.subRule = rule('bar', /\w+/);
          this.subRule2 = rule('baz', /\s+/);
        }.bind(this)).compose();
      });
      it("should set noop action for skip", function () {
        this.simpleRule.skip(true);
        this.simpleRule.actions.should.deep.equal([require('lodash').noop]);
      });
      it("should push action", function () {
        var action1 = function () {};
        var action2 = function () {};
        this.simpleRule.pushAction(action1);
        this.simpleRule.pushAction(action2);
        this.simpleRule.actions.should.deep.equal([action1, action2]);
      });
      it("should throw on invalid argument", function () {
        expect(function () { this.rule('foo', {}); }.bind(this))
          .to.throw();
      });
      it("should compose single rule", function () {
        var rule = this.simpleRule;
        rule.tokens.should.be.deep.equal(['foo']);
        rule.namespace.should.to.be.equal('foo');
        rule.tokenName.should.be.equal('foo');
        expect(rule._type).to.be.undefined();
        rule.matcher.hasSpecs().should.be.equal(false);
        rule.actions.should.be.deep.equal([]);
      });
      it("should add extra strings as tokens", function () {
        var rule = this.rule('rule', /foo/, 'foo', 'bar');
        rule.tokens.should.deep.equal(['rule', 'foo', 'bar']);
      });
      it("should support exclusive/inclusive prefix", function () {
        var foo, bar;
        var root = this.rule('root', function (rule) {
          foo = rule('-foo', /foo/);
          bar = rule('+bar', /bar/);
        });
        root.compose();
        foo.tokenName.should.be.equal('foo');
        bar.tokenName.should.be.equal('bar');
        foo.getOption('exclusive').should.be.equal(true);
        bar.getOption('exclusive').should.be.equal(false);
        root.matcher.asString().should.equal('(bar)');
        root.namespace.should.be.equal('root');
      });
      it("should compose multiple rules", function () {
        var main;
        var root = this.rule('root', function (rule) {
          rule('-foo', /foo/);
          rule('-bar', /bar/);
          main = rule('main', ['foo', 'bar']);
        });
        root.compose();
        main.matcher.asString().should.be.equal('(foo)|(bar)');
        main.matcher._specs.length.should.be.equal(2);
        main.matcher.name().should.be.equal('root.main');
        var str = "foobar";
        main.matcher.exec(str).should.deep.equal([['foo'], 'root.main.foo', 0, 3]);
        main.matcher.exec(str).should.deep.equal([['bar'], 'root.main.bar', 1, 6]);
      });
      it("should compose multiple subrules inclusive", function () {
        var main;
        var root = this.rule('root', function (rule) {
          rule('-foo', /foo/, function () {
            rule('baz', /baz/, function () {
              rule('bat', /bat/);
            });
          });
          main = rule('main', ['+foo']);
        });
        root.compose();
        main.matcher.asString().should.equal('(foo)|(baz)|(bat)');
        main._rules[0].namespace.should.be.equal('root.main.foo');
        main._rules[0]._rules[0].namespace.should.be.equal('root.main.foo.baz');
        main._rules[0]._rules[0]._rules[0].namespace.should.be.equal('root.main.foo.baz.bat');
      });
      it("should compose multiple subrules exclusive", function () {
        var main;
        var root = this.rule('root', function (rule) {
          rule('-foo', /foo/, function () {
            rule('baz', /baz/, function () {
              rule('bat', /bat/);
            });
          });
          main = rule('main', ['-foo']);
        });
        root.compose();
        main.matcher.asString().should.equal('(baz)|(bat)');
        main._rules[0].namespace.should.be.equal('root.main.baz');
        main._rules[0]._rules[0].namespace.should.be.equal('root.main.baz.bat');
      });
      it("should set tokens", function () {
        this.ruleWithRule.tokens.should.be.deep.equal(['foo']);
        this.subRule.tokens.should.be.deep.equal(['bar']);
        this.subRule2.tokens.should.be.deep.equal(['baz']);
      });
      it("should set namespace", function () {
        this.ruleWithRule.namespace.should.be.equal('foo');
        this.subRule.namespace.should.be.equal('foo.bar');
        this.subRule2.namespace.should.be.equal('foo.baz');
      });
      it("should set tokenName", function () {
        this.ruleWithRule.tokenName.should.be.equal('foo');
        this.subRule.tokenName.should.be.equal('bar');
        this.subRule2.tokenName.should.be.equal('baz');
      });
      it("should setup matcher", function () {
        this.ruleWithRule.matcher.hasSpecs().should.be.equal(true);
        this.subRule.matcher.hasSpecs().should.be.equal(true);
        this.ruleWithRule.matcher.asString().should.be.equal('(\\w+)|(\\s+)');
        this.subRule.matcher.asString().should.be.equal('(\\w+)');
        this.subRule2.matcher.asString().should.be.equal('(\\s+)');
      });
      it("should set parent/child relations", function () {
        this.ruleWithRule._root.should.be.equal(this.ruleWithRule);
        this.subRule._root.should.be.equal(this.ruleWithRule);
        this.subRule.root().should.be.equal(this.ruleWithRule);
        this.subRule2._root.should.be.equal(this.ruleWithRule);
        this.subRule._parent.should.be.equal(this.ruleWithRule);
        this.subRule.parent().should.be.equal(this.ruleWithRule);
        this.subRule2._parent.should.be.equal(this.ruleWithRule);
        this.ruleWithRule._rules.length.should.be.equal(2);
        this.ruleWithRule._rules[0].should.be.equal(this.subRule);
        this.ruleWithRule._rules[1].should.be.equal(this.subRule2);
        var cnt = 0;
        this.ruleWithRule.forEach(function (ruleForEach) {
          cnt++;
          if (cnt === 1)
            ruleForEach.should.be.equal(this.subRule);
          if (cnt === 2)
            ruleForEach.should.be.equal(this.subRule2);
        }.bind(this));
        cnt.should.be.equal(2);
      });
    });
  });
})();