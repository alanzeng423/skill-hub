# Fidelity matrix

Use the strongest available native representation and state every fallback explicitly.

| Source content | Preferred target representation | Required verification | Typical fallback |
|---|---|---|---|
| Text and rich styles | Native Docx text runs | text/style and block counts | none |
| Headings, lists, quotes, callouts | Same native block types | structural counts/order | styled paragraph only with approval |
| Code and equations | Native code/LaTeX blocks | content and language metadata | fenced/plain text with approval |
| Tables and layouts | Native table/column/grid blocks | rows, cells, spans, order | flattened table only with approval |
| Images | Re-uploaded target media | count, dimensions/caption where exposed | none |
| Attachments | Re-uploaded file block/card | filename, count, target token/href | external/source link with approval |
| Sheet | Imported workbook plus native Sheet block | workbook sheets and final embedded token | link/card with approval |
| Base | Imported Base plus supported native block/card | tables/fields/records and target token | link/card with approval |
| Whiteboard | Native structural import | node count/render comparison | labeled PNG snapshot; loses editability |
| Wiki/My Library hierarchy | Native nodes with mapped parents | exact parent/child sets | none |
| Document icon | Native icon/emoji metadata | icon equality | report unsupported custom icon |
| Internal link | Rewritten target reference | no in-scope source token remains | source hyperlink for out-of-scope target |
| Task block | Native task if cross-tenant creation is supported | task identity/state | static checkbox/status text |
| Synced block | New target-local sync relationship | source/member semantics | static content |
| Plugin/readonly block | Equivalent native block when available | semantic and visual inspection | explanatory static content or snapshot |

“High fidelity” means all supported semantics are native and all exceptions are enumerated. It does not mean pixel identity across tenant themes, target-side normalization, or unsupported products.
