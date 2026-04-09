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
        return `<nobr>\`${s.toString().replace(/(`)/g, '\\$1')}\`</nobr>`;
      })
      .join(', ');
    return new jsonschema2mk.Handlebars.SafeString(result);
  });

  // Returns the numeric heading level for a given path.
  // Used to generate HTML heading tags with explicit id attributes
  // instead of <a name="..."> anchors (which starlight-links-validator
  // does not recognize).
  jsonschema2mk.Handlebars.registerHelper('mdlevelnumber', function (path) {
    const helper = require('jsonschema2mk/helper');
    let level = 1;
    if (path && path !== 'root') {
      level = path.split(/\./).length + 1;
    }
    return level + helper.level_plus;
  });
};
