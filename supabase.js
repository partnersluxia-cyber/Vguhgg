"use strict";

window.metroDropSupabase = (() => {
	const projectUrl = "https://ioiqdllargpfaolusyuo.supabase.co";
	const publishableKey = "sb_publishable_v8BCQQNEkgXUYcPwcGSj6A_Ifzg-dkv";
	const apiUrl = `${projectUrl}/rest/v1`;
	const headers = {
		apikey: publishableKey,
		Authorization: `Bearer ${publishableKey}`,
		"Content-Type": "application/json"
	};

	const request = async (path, options = {}) => {
		const response = await fetch(`${apiUrl}/${path}`, {
			...options,
			headers: { ...headers, ...(options.headers || {}) }
		});
		if (!response.ok) throw new Error(`Supabase request failed: ${response.status}`);
		return response.status === 204 ? null : response.json();
	};

	return {
		load: async () => {
			const [sections, cases] = await Promise.all([
				request("case_sections?select=*&order=created_at.asc"),
				request("cases?select=*&order=created_at.asc")
			]);
			return { sections, cases };
		},
		loadPlayerByIdentifier: async (identifier) => {
			const result = await request(`players?or=(name.eq.${encodeURIComponent(identifier)},id.eq.${encodeURIComponent(identifier)})&order=created_at.asc&limit=1`);
			return Array.isArray(result) ? result[0] || null : null;
		},
		loadPlayers: async () => request("players?select=*&order=created_at.desc"),
		loadPromoCodes: async () => request("promo_codes?select=*&order=created_at.desc"),
		loadPromoActivationLogs: async () => request("promo_activation_logs?select=*&order=activated_at.desc"),
		createPromoCodes: (codes) => request("promo_codes", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(codes) }),
		createPromoActivationLog: (log) => request("promo_activation_logs", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(log) }),
		loadWorkbenchSettings: async () => {
			const result = await request("workbench_settings?id=eq.true&select=*&limit=1");
			return Array.isArray(result) ? result[0] || { contents: [] } : { contents: [] };
		},
		getServerTime: async () => {
			const serverTime = await request("rpc/get_server_time", { method: "POST", body: "{}" });
			return Date.parse(serverTime);
		},
		updateWorkbenchSettings: (contents) => request("workbench_settings?on_conflict=id", {
			method: "POST",
			headers: { Prefer: "return=representation,resolution=merge-duplicates" },
			body: JSON.stringify({ id: true, contents, updated_at: new Date().toISOString() })
		}),
		getPromoCode: async (code) => {
			const result = await request(`promo_codes?code=eq.${encodeURIComponent(code)}&select=*`);
			return Array.isArray(result) ? result[0] || null : null;
		},
		usePromoCode: (id, playerId, usesCount, maxUses) => request(`promo_codes?id=eq.${encodeURIComponent(id)}&is_used=eq.false&uses_count=eq.${Number(usesCount) || 0}`, {
			method: "PATCH",
			headers: { Prefer: "return=representation" },
			body: JSON.stringify({
				uses_count: (Number(usesCount) || 0) + 1,
				is_used: (Number(usesCount) || 0) + 1 >= Math.max(1, Number(maxUses) || 1),
				used_by: playerId,
				used_at: new Date().toISOString()
			})
		}),
		deletePromoCode: (id) => request(`promo_codes?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }),
		getPlayerById: async (id) => {
			const result = await request(`players?id=eq.${encodeURIComponent(id)}&select=*`);
			return Array.isArray(result) ? result[0] || null : null;
		},
		createPlayer: (account) => request("players", {
			method: "POST",
			headers: { Prefer: "return=representation" },
			body: JSON.stringify({
				...account,
				balance: Number(account.balance) || 0,
				uc_balance: Number(account.uc_balance) || 0,
				time_cards: Number(account.time_cards) || 0,
				currency_mode: account.currency_mode || "metro",
				inventory: Array.isArray(account.inventory) ? account.inventory : [],
				avatar: typeof account.avatar === "string" ? account.avatar : ""
			})
		}),
		updatePlayer: (id, updates) => request(`players?id=eq.${encodeURIComponent(id)}`, {
			method: "PATCH",
			headers: { Prefer: "return=representation" },
			body: JSON.stringify(updates)
		}),
		deletePlayer: (id) => request(`players?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }),
		createSection: (section) => request("case_sections", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(section) }),
		createCase: (item) => request("cases", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(item) }),
		updateCase: (id, item) => request(`cases?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(item) }),
		deleteSection: (id) => request(`case_sections?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }),
		deleteCasesBySection: (id) => request(`cases?section_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }),
		deleteCase: (id) => request(`cases?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" })
	};
})();