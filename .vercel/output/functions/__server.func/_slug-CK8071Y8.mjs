import { S as require_jsx_runtime, b as Navigate } from "./_libs/@tanstack/react-router+[...].mjs";
import { o as Route$1 } from "./_ssr/router-CsO_oSRi.mjs";
import { i as isPanel, n as Frame, r as Panel } from "./_ssr/views-CyKkU0qQ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_slug-CK8071Y8.js
var import_jsx_runtime = require_jsx_runtime();
function PanelPage() {
	const { slug } = Route$1.useParams();
	if (!isPanel(slug)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to: "/" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Frame, {
		active: slug,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { slug })
	});
}
//#endregion
export { PanelPage as component };
