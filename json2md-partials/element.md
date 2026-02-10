{{#if path~}}
<a name="{{{tolink (or path 'root')}}}"></a>
{{/if~}}
{{#if path}}{{{mdlevel path}}} {{escape path}}: {{escape (or title (or type 'any'))}}{{/if}}

{{#if deprecated}}(DEPRECATED){{/if}}

{{> type . ~}}
{{#each (get_examples .) ~}}
{{> example ~}}
{{/each ~}}
{{#each (get_ref_items) ~}}
{{>element . ~}}
{{/each ~}}
