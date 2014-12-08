/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
/* jshint undef: true, unused: true */
/* global describe:false, it: false */
(function () {
  "use strict";
  describe("lex#exports", function () {
    it("should load without throwing errors", function () {
      (function () {
        require("../index.js");
      })
      .should.not.throw();
    });
    it("should export", function () {
      var clex = require("../index.js");
      clex.should.be.a('object');
      clex.retool.should.be.a('object');
      clex.rule.should.be.a('function');
      clex.lexer.should.be.a('function');
    });
    it("should instanciate", function () {
      var clex = require("../index.js");
      var lex = clex.lexer();
      lex.should.be.instanceof(clex.Lex);
      var rule = clex.rule();
      rule.should.be.instanceof(clex.rule);
    });
  });

})();
