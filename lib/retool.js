/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  var _ = require("lodash");
  var matchEsc = /([.*+?^${}()|\[\]\/\\])/;
  var ReTool = {
    escape: function (str) {
      return str.replace(matchEsc, "\\$1");
    },
    backslash: function (str) {
      return new RegExp('(?:\\\\(?:\\\\\\\\)*' + (_.isRegExp(str) ? str.source : ReTool.escape(str)) + ')');
    }
  };
  module.exports = ReTool;
})();