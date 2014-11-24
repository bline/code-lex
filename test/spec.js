/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
/* jshint undef: true, unused: true */
/* global describe:false, it: false, expect: false */
(function () {
  "use strict";
  describe("dex#exports", function () {
    it("should load without throwing errors", function () {
      (function () {
        require("../index.js");
      })
      .should.not.throw();
    });
    it("should export a function", function () {
      require("../index.js").should.be.a('function');
    });
  });
})();
