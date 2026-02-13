module.exports = function (data, jsonschema2mk) {
  jsonschema2mk.Handlebars.registerHelper('code', function (string) {
    if (typeof string === 'undefined') {
      return '';
    }
    if (!Array.isArray(string)) {
      string = [string];
    }
    const result = string
      .map(function (s) {
        return '<nobr>`' + s.toString().replace(/(`)/g, '\\$1') + '`</nobr>';
      })
      .join(', ');
    return new jsonschema2mk.Handlebars.SafeString(result);
  });
};
