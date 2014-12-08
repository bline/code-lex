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
    describe("compose", function () {
      beforeEach(function () {
        this.simpleRule = this.rule('foo').compose();
        this.ruleWithRule = this.rule('foo', function (rule) {
          this.subRule = rule('bar', /\w+/);
          this.subRule2 = rule('baz', /\s+/);
        }.bind(this)).compose();
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
        this.subRule2._root.should.be.equal(this.ruleWithRule);
        this.subRule._parent.should.be.equal(this.ruleWithRule);
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