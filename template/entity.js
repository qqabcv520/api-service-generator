module.exports = `
{{#dependencies}}
import {{{.}}} from './{{{.}}}';
{{/dependencies}}

export default interface {{name}} {
  {{#properties}}
{{#description}}    // {{{.}}}{{/description}}
    {{{name}}}?: {{{typeStr}}};
  {{/properties}}
}

`;
