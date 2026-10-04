import { i as getServerFnById, n as createServerFn, r as TSS_SERVER_FUNCTION } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sync-CMSDJesh.js
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function device(value) {
	const id = String(value || "").trim();
	if (!UUID.test(id)) throw new Error("bad device");
	return id;
}
var pullBoard = createServerFn({ method: "POST" }).validator((id) => device(id)).handler(createSsrRpc("9cfd941d8bd78387fd8ebfd76a9afcdc28769fb6babc222e81c215898baad78d"));
var pushBoard = createServerFn({ method: "POST" }).validator((input) => {
	const id = device(input?.device);
	const payload = String(input?.payload || "");
	if (payload.length > 9e5) throw new Error("Board is too large");
	const parsed = JSON.parse(payload);
	delete parsed.keys;
	delete parsed.vault;
	return {
		id,
		payload: JSON.stringify(parsed)
	};
}).handler(createSsrRpc("e9d0e0346919adc719a37f581ec9395ad24ad1eb656a639fc7e8b18935b9e094"));
var askNyx = createServerFn({ method: "POST" }).validator((input) => {
	const question = String(input?.question || "").trim().slice(0, 400);
	const facts = String(input?.facts || "").slice(0, 1800);
	if (!question) throw new Error("question required");
	return {
		question,
		facts
	};
}).handler(createSsrRpc("be998f075e8d8075f9256b47a873c47f348a89d05e1a44a2b1d2fda9bdde3b96"));
var pullCalendar = createServerFn({ method: "POST" }).validator(() => ({})).handler(createSsrRpc("6e730b5e9c79d56d3084b2c9fd82075b3340881ff5d3c704b46fd5daecee1ed3"));
//#endregion
export { askNyx, pullBoard, pullCalendar, pushBoard };
