{{#if path~}}
<h{{mdlevelnumber path}} id="{{{tolink (or path 'root')}}}">{{escape path}}: {{escape (or title (or type 'any'))}}</h{{mdlevelnumber path}}>
{{/if}}

{{#if deprecated}}(DEPRECATED){{/if}}

{{> type . ~}}
{{#each (get_examples .) ~}}
{{> example ~}}
{{/each ~}}
{{#each (get_ref_items) ~}}
{{>element . ~}}
{{/each ~}}
