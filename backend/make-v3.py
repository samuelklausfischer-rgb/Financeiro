import json
from pathlib import Path

BASE = Path(r"C:\Users\OPERACIONAL\Desktop\AUTOMAÇÃO\automação analise\prn-reporting")
WF_IN = BASE / "src" / "n8n" / "workflows" / "WF-PRN-MAIN-v2.json"
WF_OUT = BASE / "src" / "n8n" / "workflows" / "WF-PRN-MAIN-v3.json"

FORM_HTML = (BASE / "src" / "templates" / "form.html").read_text(encoding="utf-8")
ERROR_JS = (BASE / "src" / "templates" / "error.js").read_text(encoding="utf-8")
HTML_RENDERER_JS = (BASE / "src" / "n8n" / "lib" / "html-renderer.js").read_text(encoding="utf-8")


def strip_module_exports(js: str) -> str:
    lines = []
    for line in js.splitlines():
        if "module.exports" in line:
            continue
        lines.append(line)
    return "\n".join(lines).strip() + "\n"


error_core = strip_module_exports(ERROR_JS)
renderer_core = strip_module_exports(HTML_RENDERER_JS)

serve_form_code = (
    "const html = " + json.dumps(FORM_HTML, ensure_ascii=False) + ";\n"
    "return [{ json: { html } }];"
)

render_error_code = (
    error_core
    + "\n"
    + "const input = $input.first().json;\n"
    + "const errorCode = input.errorCode || 'ERROR';\n"
    + "const errorMessage = input.error || 'Erro desconhecido';\n"
    + "const requestId = input.requestId || '';\n"
    + "const details = input.details || null;\n"
    + "const html = renderErrorPage(errorCode, errorMessage, details, requestId);\n"
    + "return [{ json: { html } }];\n"
)

render_report_code = (
    "const input = $input.first().json;\n"
    "\n"
    "if (!input.success) {\n"
    + error_core
    + "\n"
    + "  const html = renderErrorPage(input.errorCode || 'PROCESSING_ERROR', input.error || 'Erro desconhecido', input.details || null, input.requestId || '');\n"
    + "  return [{ json: { html } }];\n"
    + "}\n\n"
    + renderer_core
    + "\n"
    + "const report = input.report;\n"
    + "const html = renderReportHTML(report);\n"
    + "return [{ json: { html } }];\n"
)

workflow = json.loads(WF_IN.read_text(encoding="utf-8"))
workflow["name"] = "PRN Financial Report v3"
workflow["versionId"] = "3.0.0"
workflow["meta"] = {"instanceId": "prn-reporting-v3"}

for node in workflow.get("nodes", []):
    if node.get("name") == "Code: Serve Form":
        node["parameters"]["jsCode"] = serve_form_code
    elif node.get("name") == "Code: Render Error":
        node["parameters"]["jsCode"] = render_error_code
    elif node.get("name") == "Code: Render Report":
        node["parameters"]["jsCode"] = render_report_code

WF_OUT.write_text(json.dumps(workflow, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"Generated: {WF_OUT}")
print(f"Size: {WF_OUT.stat().st_size} bytes")
