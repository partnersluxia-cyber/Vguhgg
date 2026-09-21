"use strict";

document.documentElement.classList.add("js-ready");

const menuToggle = document.querySelector(".menu-toggle");
const mainMenu = document.querySelector(".main-nav");
const clickSounds = Array.from({ length: 4 }, () => {
	const sound = new Audio("sounds/click_default.mp3");
	sound.preload = "auto";
	sound.volume = 0.9;
	return sound;
});
let nextClickSound = 0;
const currencyStorageKey = "metroDropCurrencyMode";
let activeCurrency = "metro";
const metroToUcRate = 100000 / 60;

const safeStorage = {
	get: (key) => {
		if (typeof localStorage !== "undefined") {
			const localValue = localStorage.getItem(key);
			if (localValue !== null) return localValue;
		}
		if (typeof sessionStorage !== "undefined") {
			return sessionStorage.getItem(key);
		}
		return null;
	},
	set: (key, value) => {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(key, value);
		}
		if (typeof sessionStorage !== "undefined") {
			sessionStorage.setItem(key, value);
		}
	},
	remove: (key) => {
		if (typeof localStorage !== "undefined") {
			localStorage.removeItem(key);
		}
		if (typeof sessionStorage !== "undefined") {
			sessionStorage.removeItem(key);
		}
	}
};

const syncActiveCurrency = (player) => {
	activeCurrency = player?.currency_mode === "uc" ? "uc" : "metro";
	safeStorage.set(currencyStorageKey, activeCurrency);
};

const formatCurrencyValue = (metroValue) => {
	const value = Number(metroValue) || 0;
	if (activeCurrency === "uc") {
		return (value / metroToUcRate).toFixed(2).replace(/\.00$/, "");
	}
	return String(Math.round(value));
};

const updateHomeCasePrices = () => {
	document.querySelectorAll("[data-base-price]").forEach((price) => {
		price.firstChild.textContent = formatCurrencyValue(price.dataset.basePrice);
		const currency = price.querySelector("img");
		if (currency) {
			currency.src = activeCurrency === "uc" ? "img/uc.png" : "img/metro_money.png";
			currency.alt = activeCurrency === "uc" ? "UC" : "Метровалюты";
		}
	});
};

const promoBars = Array.from(document.querySelectorAll(".home-promo-dots span"));
const promoSlides = Array.from(document.querySelectorAll(".home-promo-slide:not(.home-promo-clone)"));
const promoTrack = document.querySelector(".home-promo-track");
const promoSlidesRow = document.querySelector(".home-promo-slides");
let activePromoBar = 0;
let promoPointerStartX = 0;
let promoPointerStartY = 0;
let isPromoDragging = false;
let promoAutoplayTimer;

const showPromoSlide = (index) => {
	const nextPromoBar = (index + promoBars.length) % promoBars.length;
	const isForwardLoop = activePromoBar === promoSlides.length - 1 && nextPromoBar === 0;
	activePromoBar = isForwardLoop ? promoSlides.length : nextPromoBar;
	promoBars.forEach((bar, barIndex) => bar.classList.toggle("is-active", barIndex === nextPromoBar));
	promoSlides.forEach((slide, slideIndex) => slide.setAttribute("aria-hidden", String(slideIndex !== nextPromoBar)));
	if (promoSlidesRow) {
		promoSlidesRow.style.transform = `translateX(-${activePromoBar * 25}%)`;
	}

	if (isForwardLoop) {
		window.setTimeout(() => {
			if (activePromoBar !== promoSlides.length) return;
			promoSlidesRow.style.transition = "none";
			activePromoBar = 0;
			promoSlidesRow.style.transform = "translateX(0)";
			void promoSlidesRow.offsetWidth;
			promoSlidesRow.style.transition = "";
		}, 650);
	}
};

if (promoBars.length && promoSlides.length === promoBars.length) {
	showPromoSlide(0);
}

const schedulePromoAutoplay = () => {
	window.clearTimeout(promoAutoplayTimer);
	promoAutoplayTimer = window.setTimeout(() => {
		showPromoSlide(activePromoBar + 1);
		schedulePromoAutoplay();
	}, 5000);
};

promoBars.forEach((bar, index) => {
	bar.addEventListener("click", () => {
		showPromoSlide(index);
		schedulePromoAutoplay();
	});
});

promoTrack?.addEventListener("pointerdown", (event) => {
	promoPointerStartX = event.clientX;
	promoPointerStartY = event.clientY;
	isPromoDragging = true;
	try {
		promoTrack.setPointerCapture(event.pointerId);
	} catch {
	}
});

promoTrack?.addEventListener("pointerup", (event) => {
	if (!isPromoDragging) return;
	isPromoDragging = false;
	const horizontalDistance = event.clientX - promoPointerStartX;
	const verticalDistance = event.clientY - promoPointerStartY;
	if (Math.abs(horizontalDistance) < 40 || Math.abs(horizontalDistance) < Math.abs(verticalDistance)) return;
	showPromoSlide(activePromoBar + (horizontalDistance < 0 ? 1 : -1));
	schedulePromoAutoplay();
});

promoTrack?.addEventListener("pointercancel", () => {
	isPromoDragging = false;
});

if (promoBars.length > 1 && promoSlides.length === promoBars.length) {
	schedulePromoAutoplay();
}

const renderHomeCases = async () => {
	const container = document.querySelector("#homeCaseSections");
	if (!container || !window.metroDropSupabase?.load) return;

	let sections = [];
	let cases = [];
	try {
		const remoteState = await window.metroDropSupabase.load();
		sections = remoteState.sections;
		cases = remoteState.cases.map((item) => ({ ...item, sectionId: item.section_id ?? item.sectionId }));
	} catch (error) {
		sections = [];
		cases = [];
		console.error("Supabase unavailable", error);
	}
	container.replaceChildren();

	sections.forEach((section) => {
		const sectionElement = document.createElement("section");
		sectionElement.className = "home-case-section";
		sectionElement.dataset.sectionId = section.id;

		const heading = document.createElement("div");
		heading.className = "home-case-heading";
		const title = document.createElement("h2");
		title.textContent = section.name;
		heading.append(title);
		if (section.description) {
			const description = document.createElement("p");
			description.textContent = section.description;
			heading.append(description);
		}
		sectionElement.append(heading);

		const grid = document.createElement("div");
		grid.className = "home-case-grid";
		cases.filter((item) => item.sectionId === section.id).forEach((item) => {
			const card = document.createElement("a");
			card.className = "home-case-card";
			card.href = `case.html?id=${encodeURIComponent(item.id)}`;
			card.setAttribute("aria-label", `Открыть кейс ${item.name}`);
			const image = document.createElement("img");
			image.src = item.image;
			image.alt = item.name;
			image.loading = "lazy";
			card.append(image);
			const title = document.createElement("h3");
			title.textContent = item.name;
			card.append(title);
			const price = document.createElement("span");
			price.className = "home-case-price";
			price.dataset.basePrice = Number(item.price) || 0;
			price.append(document.createTextNode(formatCurrencyValue(item.price)));
			const currency = document.createElement("img");
			currency.src = activeCurrency === "uc" ? "img/uc.png" : "img/metro_money.png";
			currency.alt = activeCurrency === "uc" ? "UC" : "Метровалюты";
			price.append(currency);
			card.append(price);
			if (item.description) {
				const description = document.createElement("p");
				description.textContent = item.description;
				card.append(description);
			}
			grid.append(card);
		});
		sectionElement.append(grid);
		container.append(sectionElement);
	});
};

renderHomeCases();

const playClickSound = () => {
	const sound = clickSounds[nextClickSound];
	nextClickSound = (nextClickSound + 1) % clickSounds.length;
	sound.currentTime = 0;
	sound.play().catch(() => {});
};

const questsSound = new Audio("sounds/click_quests_collection.mp3");
questsSound.preload = "auto";
questsSound.volume = 0.9;
const missionNavigationKey = "metroDropPlayMissionSound";

const verstakSound = new Audio("sounds/verstak.mp3");
verstakSound.preload = "auto";
verstakSound.volume = 0.9;
const verstakNavigationKey = "metroDropPlayVerstakSound";
const pageSound = new Audio("sounds/page.mp3");
pageSound.preload = "auto";
pageSound.volume = 0.9;
const pageNavigationKey = "metroDropPlayPageSound";
const missionsSound = new Audio("sounds/missions.mp3");
missionsSound.preload = "auto";
missionsSound.volume = 0.4;
const missionsNavigationKey = "metroDropPlayMissionsSound";

const playPendingNavigationSound = (sound, storageKey) => {
	if (sessionStorage.getItem(storageKey) !== "true") {
		return;
	}
	sessionStorage.removeItem(storageKey);

	const attemptPlayback = () => {
		if (!sound || typeof sound.play !== "function") {
			return;
		}
		sound.currentTime = 0;
		const playback = sound.play();
		if (playback?.catch) {
			playback.catch(() => {
				document.addEventListener("touchstart", attemptPlayback, { once: true, passive: true });
				document.addEventListener("pointerdown", attemptPlayback, { once: true, passive: true });
				document.addEventListener("click", attemptPlayback, { once: true, passive: true });
				document.addEventListener("keydown", attemptPlayback, { once: true });
			});
		}
	};

	attemptPlayback();
};

const playNavigationSoundImmediately = (sound, storageKey) => {
	if (!sound || typeof sound.play !== "function") {
		return;
	}

	sound.currentTime = 0;
	const playback = sound.play();
	if (playback?.catch) {
		playback.catch(() => {
			sessionStorage.setItem(storageKey, "true");
		});
	}
};

playPendingNavigationSound(questsSound, missionNavigationKey);
playPendingNavigationSound(verstakSound, verstakNavigationKey);
playPendingNavigationSound(pageSound, pageNavigationKey);
playPendingNavigationSound(missionsSound, missionsNavigationKey);
menuToggle.addEventListener("click", () => {
	const isOpen = mainMenu.classList.toggle("is-open");
	menuToggle.classList.toggle("is-open", isOpen);
	menuToggle.setAttribute("aria-expanded", String(isOpen));
	menuToggle.querySelector(".visually-hidden").textContent = isOpen
		? "Закрыть меню"
		: "Открыть меню";
	playClickSound();
});

document.querySelectorAll(".mobile-menu-item").forEach((menuItem) => {
	menuItem.addEventListener("click", (event) => {
		if (menuItem.getAttribute("href")?.includes("#upgrade")) {
			event.preventDefault();
			giveEpicBackpack();
		}
		mainMenu.classList.remove("is-open");
		menuToggle.classList.remove("is-open");
		menuToggle.setAttribute("aria-expanded", "false");
		menuToggle.querySelector(".visually-hidden").textContent = "Открыть меню";
	});
});

const navigateWithMenuClose = (href, pageKey) => {
	if (mainMenu?.classList.contains("is-open")) {
		mainMenu.classList.remove("is-open");
		menuToggle.classList.remove("is-open");
		menuToggle.setAttribute("aria-expanded", "false");
		menuToggle.querySelector(".visually-hidden").textContent = "Открыть меню";
	}

	sessionStorage.setItem(pageKey, "true");
	window.setTimeout(() => {
		window.location.href = href;
	}, 150);
};

document.querySelectorAll(".nav-link, .login-button, .mobile-menu-item").forEach((link) => {
	link.addEventListener("click", (event) => {
		const href = link.getAttribute("href");
		if (!href || !href.includes(".html")) {
			return;
		}
		event.preventDefault();
		if (href.includes("workbench.html")) {
			navigateWithMenuClose(href, verstakNavigationKey);
			return;
		}
		if (href.includes("missions.html")) {
			navigateWithMenuClose(href, missionsNavigationKey);
			return;
		}
		navigateWithMenuClose(href, pageNavigationKey);
	});
});

document.querySelectorAll(".workbench-action, .recipe-card, .chance-btn").forEach((button) => {
	button.addEventListener("click", playClickSound);
});

document.querySelectorAll(".profile-link-button").forEach((button) => {
	if (button.matches('a[href="missions.html"]')) {
		button.addEventListener("click", () => sessionStorage.setItem(missionsNavigationKey, "true"));
		return;
	}
	if (button.matches(".mission-entry")) {
		return;
	}
	button.addEventListener("click", () => {
		questsSound.currentTime = 0;
		questsSound.play().catch(() => {});
	});
});

document.querySelectorAll(".mission-go-button").forEach((button) => {
	button.addEventListener("click", () => sessionStorage.setItem(missionNavigationKey, "true"));
});

const topUpModal = document.querySelector("[data-top-up-modal]");
const topUpButton = document.querySelector(".profile-balance-add");
const topUpClose = topUpModal?.querySelector("[data-top-up-close]");
const topUpPromoOpen = topUpModal?.querySelector("[data-top-up-promo-open]");
const topUpPromoForm = topUpModal?.querySelector("[data-top-up-promo-form]");
const topUpPromoInput = topUpPromoForm?.querySelector("input");
const topUpPromoMessage = topUpPromoForm?.querySelector("[data-top-up-promo-message]");

const setTopUpPromoMessage = (message = "", state = "", showCurrency = false) => {
	if (!topUpPromoMessage) return;
	topUpPromoMessage.replaceChildren(document.createTextNode(message));
	if (showCurrency) {
		const currency = document.createElement("img");
		currency.src = "img/metro_money.png";
		currency.alt = "Метровалюты";
		topUpPromoMessage.append(currency);
	}
	topUpPromoMessage.className = `top-up-promo-message${state ? ` is-${state}` : ""}`;
};

const closeTopUpPromo = () => {
	if (!topUpModal || !topUpPromoForm) return;
	topUpPromoForm.hidden = true;
	topUpPromoOpen.hidden = false;
	topUpModal.querySelectorAll("[data-top-up-shop], [data-top-up-currency]").forEach((element) => {
		element.hidden = element.matches("[data-top-up-shop]")
			? element.dataset.topUpShop !== topUpModal.querySelector("[data-top-up-currency].is-selected")?.dataset.topUpCurrency
			: false;
	});
};

const closeTopUpModal = () => {
	if (!topUpModal) {
		return;
	}
	topUpModal.hidden = true;
	topUpModal.classList.remove("is-visible");
};

topUpButton?.addEventListener("click", () => {
	if (!topUpModal) {
		return;
	}
	topUpModal.hidden = false;
	topUpModal.classList.add("is-visible");
	closeTopUpPromo();
	topUpModal.querySelector(".top-up-currency")?.focus();
	playClickSound();
});

topUpClose?.addEventListener("click", closeTopUpModal);
topUpModal?.addEventListener("click", (event) => {
	if (event.target === topUpModal) {
		closeTopUpModal();
	}
});

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && topUpModal && !topUpModal.hidden) {
		closeTopUpModal();
	}
});

topUpModal?.querySelectorAll("[data-top-up-currency]").forEach((button) => {
	button.addEventListener("click", () => {
		closeTopUpPromo();
		topUpModal.querySelectorAll("[data-top-up-currency]").forEach((item) => item.classList.remove("is-selected"));
		button.classList.add("is-selected");
		topUpModal.querySelectorAll("[data-top-up-shop]").forEach((shop) => {
			shop.hidden = shop.dataset.topUpShop !== button.dataset.topUpCurrency;
		});
	});
});

topUpModal?.querySelectorAll("[data-top-up-url]").forEach((product) => {
	product.addEventListener("click", () => {
		window.location.href = product.dataset.topUpUrl;
	});
});

topUpPromoOpen?.addEventListener("click", () => {
	topUpModal.querySelectorAll("[data-top-up-shop], [data-top-up-currency]").forEach((element) => {
		element.hidden = true;
	});
	topUpPromoOpen.hidden = true;
	topUpPromoForm.hidden = false;
	setTopUpPromoMessage();
	topUpPromoInput?.focus();
	playClickSound();
});

topUpPromoForm?.addEventListener("submit", (event) => {
	event.preventDefault();
	const activatePromoCode = async () => {
		const code = topUpPromoInput?.value.trim().toUpperCase();
		if (!code) return;
		const player = getCachedCurrentPlayer() || await getCurrentPlayer();
		if (!player?.id) {
			setTopUpPromoMessage("СНАЧАЛА ВОЙДИТЕ В АККАУНТ", "error");
			return;
		}
		try {
			const promo = await window.metroDropSupabase.getPromoCode(code);
			if (!promo || promo.is_used) {
				setTopUpPromoMessage("ПРОМОКОД НЕДЕЙСТВИТЕЛЕН", "error");
				return;
			}
			const reward = Math.max(0, Number(promo.reward_amount) || 0);
			const updatedPlayer = await window.metroDropSupabase.updatePlayer(player.id, { balance: (Number(player.balance) || 0) + reward });
			const claimed = await window.metroDropSupabase.usePromoCode(promo.id, player.id, promo.uses_count, promo.max_uses);
			if (!Array.isArray(claimed) || !claimed.length) {
				setTopUpPromoMessage("ПРОМОКОД УЖЕ ИСПОЛЬЗОВАН", "error");
				return;
			}
			let missionUpdatedPlayer = null;
			const missionProgress = getMissionProgress(player);
			const missionClaimed = getClaimedMissions(player);
			if (promo.promo_type === "topup" && (Number(missionProgress.topups_1) || 0) < 1 && !isMissionClaimed(missionClaimed.topups_1, "once")) {
				missionUpdatedPlayer = await recordMissionProgress("topups", 1);
			}
			console.info("Промокод активирован", {
				code: promo.code,
				player: player.name || "Без имени",
				playerId: player.id,
				promoType: promo.promo_type,
				reward: reward,
				activatedAt: new Date().toISOString()
			});
			const isExhausted = (Number(promo.uses_count) || 0) + 1 >= Math.max(1, Number(promo.max_uses) || 1);
			if (isExhausted) {
				try {
					await window.metroDropSupabase.deletePromoCode(promo.id);
				} catch (deleteError) {
					console.error("Не удалось удалить использованный промокод", deleteError);
				}
			}
			const logEntry = {
				id: promo.id,
				code: promo.code,
				player: player.name || "Без имени",
				playerId: player.id,
				promoType: promo.promo_type,
				reward,
				activatedAt: new Date().toISOString()
			};
			try {
				await window.metroDropSupabase.createPromoActivationLog({
					id: crypto.randomUUID(),
					promo_code: logEntry.code,
					player_name: logEntry.player,
					player_id: logEntry.playerId,
					promo_type: logEntry.promoType,
					reward_amount: logEntry.reward,
					activated_at: logEntry.activatedAt
				});
			} catch (logError) {
				console.error("Не удалось сохранить журнал активации", logError);
			}
			let activationLog = [];
			try {
				activationLog = JSON.parse(localStorage.getItem("metroDropPromoActivationLog") || "[]");
			} catch {
				activationLog = [];
			}
			localStorage.setItem("metroDropPromoActivationLog", JSON.stringify([logEntry, ...activationLog].slice(0, 100)));
			localStorage.setItem("metroDropPromoActivation", JSON.stringify({ ...logEntry, updatedAt: Date.now() }));
			const balanceUpdatedPlayer = Array.isArray(updatedPlayer) ? updatedPlayer[0] : updatedPlayer;
			setCachedCurrentPlayer(missionUpdatedPlayer
				? { ...balanceUpdatedPlayer, mission_progress: missionUpdatedPlayer.mission_progress }
				: balanceUpdatedPlayer);
			topUpPromoInput.value = "";
			setTopUpPromoMessage(`БАЛАНС ПОПОЛНЕН НА ${reward}`, "success", true);
		} catch (error) {
			console.error("Promo code activation failed", error);
			setTopUpPromoMessage("НЕ УДАЛОСЬ АКТИВИРОВАТЬ ПРОМОКОД", "error");
		}
	};
	playClickSound();
	activatePromoCode();
});

document.querySelectorAll(".recipe-card").forEach((recipe) => {
	recipe.addEventListener("click", () => {
		document.querySelectorAll(".recipe-card").forEach((item) => item.classList.remove("is-selected"));
		recipe.classList.add("is-selected");
	});
});

const workbenchCrate = document.querySelector(".workbench-crate");
const workbenchBox = document.querySelector(".workbench-box");
const getButton = document.querySelector(".workbench-get-button");
const disassembleButton = document.querySelector(".workbench-disassemble-button");
const boostButton = document.querySelector(".workbench-boost-button");
const workbenchTimer = document.querySelector(".workbench-timer");
const timeCardValue = document.querySelector(".time-card-header span");
const rewardControls = document.querySelector(".workbench-reward-controls");
const boostLabel = document.querySelector(".workbench-boost-label");
const boostCost = document.querySelector(".workbench-boost-cost");
const openLabel = document.querySelector(".workbench-open-label");
const lootModal = document.querySelector("[data-loot-modal]");
const workbenchLootRewards = document.querySelector("[data-workbench-loot-rewards]");
const rewardSound = new Audio("sounds/reward.mp3");
rewardSound.preload = "auto";

if (workbenchCrate && workbenchBox && getButton && disassembleButton && boostButton && workbenchTimer && timeCardValue && rewardControls && boostLabel && boostCost && openLabel && lootModal) {
	let remainingSeconds = 24 * 60 * 60;
	let timerStarted = false;
	let timeCards = Number.parseInt(timeCardValue.textContent, 10) || 0;
	let countdownTimer;
	let boostInProgress = false;
	let lootOpeningInProgress = false;
	const workbenchStartedAtStorageKey = "metroDropWorkbenchStartedAt";

	const updateBoostAvailability = () => {
		const unavailable = remainingSeconds === 0 || timeCards === 0;
		boostButton.disabled = unavailable;
		boostButton.classList.toggle("is-empty", unavailable && remainingSeconds > 0);
	};

	const showEmptyWorkbenchState = () => {
		workbenchCrate.hidden = false;
		workbenchCrate.style.display = "";
		workbenchCrate.classList.remove("is-open");
		workbenchBox.hidden = true;
		rewardControls.hidden = false;
		rewardControls.style.display = "";
		getButton.hidden = false;
		disassembleButton.hidden = true;
		boostButton.hidden = true;
		workbenchTimer.hidden = true;
		workbenchTimer.classList.remove("is-active");
	};

	const formatTimer = () => {
		const hours = Math.floor(remainingSeconds / 3600);
		const minutes = Math.floor((remainingSeconds % 3600) / 60);
		const seconds = remainingSeconds % 60;
		return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
	};

	const openBox = () => {
		if (remainingSeconds === 0) {
			workbenchBox.src = "img/box_open.png";
			workbenchBox.alt = "Открытый ящик";
			boostButton.disabled = false;
			boostButton.classList.remove("is-empty");
			boostButton.classList.add("is-opened");
			boostLabel.hidden = true;
			boostCost.hidden = true;
			openLabel.hidden = false;
		} else {
			updateBoostAvailability();
		}
	};

	const startCountdown = () => {
		window.clearInterval(countdownTimer);
		countdownTimer = window.setInterval(() => {
			remainingSeconds = Math.max(remainingSeconds - 1, 0);
			workbenchTimer.textContent = formatTimer();
			openBox();
			if (remainingSeconds === 0) {
				window.clearInterval(countdownTimer);
			}
		}, 1000);
	};

	window.setTimeout(async () => {
		const player = await getCurrentPlayer() || getCachedCurrentPlayer();
		const serverNow = await window.metroDropSupabase.getServerTime().catch(() => Date.now());
		timeCards = Math.max(0, Number(player?.time_cards) || 0);
		timeCardValue.textContent = String(timeCards);
		const storedStartedAt = player?.mission_progress?.workbench_started_at || localStorage.getItem(workbenchStartedAtStorageKey);
		const workbenchStartedAt = Number(storedStartedAt) || Date.parse(storedStartedAt) || 0;
		if (player?.mission_progress?.workbench_loot_claimed) {
			showEmptyWorkbenchState();
			return;
		}
		if (workbenchStartedAt) {
			remainingSeconds = Math.max(24 * 60 * 60 - Math.floor((serverNow - workbenchStartedAt) / 1000), 0);
			workbenchCrate.classList.add("is-open");
			workbenchBox.hidden = false;
			getButton.hidden = true;
			disassembleButton.hidden = true;
			boostButton.hidden = false;
			rewardControls.appendChild(workbenchTimer);
			workbenchTimer.classList.add("is-active");
			workbenchTimer.hidden = false;
			workbenchTimer.textContent = formatTimer();
			if (remainingSeconds === 0) {
				openBox();
			} else {
				updateBoostAvailability();
				startCountdown();
			}
			return;
		}
		if (!player?.mission_progress?.workbench_ready) return;
		workbenchCrate.classList.add("is-open");
		workbenchBox.hidden = false;
		getButton.hidden = true;
		disassembleButton.hidden = false;
	}, 0);

	getButton.addEventListener("click", () => {
		playClickSound();
		navigateWithMenuClose("missions.html", missionsNavigationKey);
	});

	disassembleButton.addEventListener("click", () => {
		if (timerStarted) {
			return;
		}
		timerStarted = true;
		const startedAt = Date.now();
		localStorage.setItem(workbenchStartedAtStorageKey, String(startedAt));
		window.setTimeout(async () => {
			const player = getCachedCurrentPlayer() || await getCurrentPlayer();
			if (!player?.id) return;
			const serverStartedAt = await window.metroDropSupabase.getServerTime().catch(() => startedAt);
			localStorage.setItem(workbenchStartedAtStorageKey, new Date(serverStartedAt).toISOString());
			const missionProgress = { ...(player.mission_progress || {}), workbench_ready: false, workbench_started_at: new Date(serverStartedAt).toISOString() };
			const result = await window.metroDropSupabase.updatePlayer(player.id, { mission_progress: missionProgress });
			setCachedCurrentPlayer(Array.isArray(result) ? result[0] : result || { ...player, mission_progress: missionProgress });
		}, 0);
		rewardControls.appendChild(workbenchTimer);
		disassembleButton.hidden = true;
		boostButton.hidden = false;
		workbenchTimer.classList.add("is-active");
		workbenchTimer.hidden = false;
		workbenchTimer.textContent = formatTimer();
		if (timeCards === 0) {
			updateBoostAvailability();
		}

		startCountdown();
	});

	boostButton.addEventListener("click", async () => {
		if (boostButton.classList.contains("is-opened")) {
			if (lootOpeningInProgress) return;
			lootOpeningInProgress = true;
			boostButton.disabled = true;
			const player = await getCurrentPlayer() || getCachedCurrentPlayer();
			if (!player?.id || player.mission_progress?.workbench_loot_claimed || !workbenchLootRewards) {
				lootOpeningInProgress = false;
				return;
			}
			try {
				const settings = await window.metroDropSupabase.loadWorkbenchSettings();
				const contents = Array.isArray(settings?.contents) ? settings.contents.filter((item) => item?.image && Number(item.chance) > 0) : [];
				const totalChance = contents.reduce((total, item) => total + Number(item.chance), 0);
				let roll = Math.random() * totalChance;
				const selectedReward = contents.find((item) => {
					roll -= Number(item.chance);
					return roll <= 0;
				}) || contents[contents.length - 1];
				if (!selectedReward) {
					lootOpeningInProgress = false;
					boostButton.disabled = false;
					return;
				}
				const siteState = await window.metroDropSupabase.load();
				const siteItems = (siteState.cases || []).flatMap((caseItem) => (caseItem.contents || []).map((item) => typeof item === "string"
					? { name: item, image: caseItem.image, rarity: "common", price: caseItem.price }
					: item));
				const rewardItem = selectedReward.rewardType === "currency"
					? selectedReward
					: { ...selectedReward, ...(siteItems.find((item) => item.image === selectedReward.image && item.name === selectedReward.name)
						|| siteItems.find((item) => item.image === selectedReward.image)
						|| {}) };
				const missionProgress = { ...(player.mission_progress || {}), workbench_loot_claimed: true, workbench_started_at: null };
				const isCurrencyReward = rewardItem.rewardType === "currency";
				const rewardAmount = Math.max(0, Number(rewardItem.amount) || 0);
				const inventory = isCurrencyReward
					? (Array.isArray(player.inventory) ? player.inventory : [])
					: [...(Array.isArray(player.inventory) ? player.inventory : []), {
						name: rewardItem.name || "Предмет верстака",
						image: rewardItem.image,
						rarity: rewardItem.rarity || "common",
						price: Math.max(0, Number(rewardItem.price) || 0),
						rarityLabel: rewardItem.rarityLabel || "ОБЫЧНЫЙ"
					}];
				const updates = { inventory, mission_progress: missionProgress };
				if (isCurrencyReward) updates.balance = (Number(player.balance) || 0) + rewardAmount;
				const result = await window.metroDropSupabase.updatePlayer(player.id, updates);
				setCachedCurrentPlayer(Array.isArray(result) ? result[0] : result || { ...player, ...updates });
				localStorage.removeItem(workbenchStartedAtStorageKey);
				showEmptyWorkbenchState();
				workbenchLootRewards.replaceChildren();
				const reward = document.createElement("div");
				reward.className = "workbench-loot-reward";
				if (isCurrencyReward) {
					reward.innerHTML = `<div class="inventory-slot has-item"><img class="inventory-item-image" src="${rewardItem.image || "items/money.png"}" alt="Метровалюта"></div><strong>${new Intl.NumberFormat("ru-RU").format(rewardAmount)}</strong>`;
				} else {
					reward.innerHTML = `<div class="inventory-slot has-item rarity-${rewardItem.rarity || "common"}"><img class="inventory-item-image" src="${rewardItem.image}" alt="${rewardItem.name || "Предмет"}"><span class="inventory-rarity" aria-hidden="true"></span></div>`;
				}
				workbenchLootRewards.append(reward);
				lootModal.hidden = false;
				lootModal.classList.add("is-visible");
				rewardSound.currentTime = 0;
				rewardSound.play().catch(() => {});
			} catch (error) {
				lootOpeningInProgress = false;
				boostButton.disabled = false;
				console.error("Failed to open workbench loot", error);
			}
			return;
		}
		if (timeCards === 0) {
			return;
		}
		if (boostInProgress) {
			return;
		}
		boostInProgress = true;
		boostButton.disabled = true;
		timeCards -= 1;
		const player = getCachedCurrentPlayer() || await getCurrentPlayer();
		if (player?.id) {
			try {
				const result = await window.metroDropSupabase.updatePlayer(player.id, { time_cards: timeCards });
				setCachedCurrentPlayer(Array.isArray(result) ? result[0] : result || { ...player, time_cards: timeCards });
			} catch (error) {
				timeCards += 1;
				boostInProgress = false;
				updateBoostAvailability();
				console.error("Failed to spend time card", error);
				return;
			}
		}
		const startSeconds = remainingSeconds;
		const targetSeconds = Math.max(startSeconds - 5 * 60 * 60, 0);
		const animationStart = performance.now();
		const animationDuration = 420;
		window.clearInterval(countdownTimer);

		const animateReduction = async (now) => {
			const progress = Math.min((now - animationStart) / animationDuration, 1);
			remainingSeconds = Math.round(startSeconds - (startSeconds - targetSeconds) * progress);
			workbenchTimer.textContent = formatTimer();
			if (progress < 1) {
				window.requestAnimationFrame(animateReduction);
				return;
			}
			remainingSeconds = targetSeconds;
			openBox();
			boostInProgress = false;
			if (remainingSeconds > 0 && timeCards > 0) {
					updateBoostAvailability();
			}
			const player = getCachedCurrentPlayer() || await getCurrentPlayer();
			if (player?.id) {
				const serverNow = await window.metroDropSupabase.getServerTime().catch(() => Date.now());
				const missionProgress = {
					...(player.mission_progress || {}),
					workbench_started_at: new Date(serverNow - (24 * 60 * 60 - targetSeconds) * 1000).toISOString()
				};
				localStorage.setItem(workbenchStartedAtStorageKey, String(missionProgress.workbench_started_at));
				const result = await window.metroDropSupabase.updatePlayer(player.id, { mission_progress: missionProgress });
				setCachedCurrentPlayer(Array.isArray(result) ? result[0] : result || { ...player, mission_progress: missionProgress });
			}
			startCountdown();
		};

		window.requestAnimationFrame(animateReduction);
		timeCardValue.textContent = String(timeCards);
		if (timeCards === 0) {
			updateBoostAvailability();
		}
	});

	lootModal.addEventListener("click", (event) => {
		if (event.target === lootModal) {
			lootModal.hidden = true;
			lootModal.classList.remove("is-visible");
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			lootModal.hidden = true;
			lootModal.classList.remove("is-visible");
		}
	});
}

const authPanel = document.querySelector(".auth-panel");
const authChoice = authPanel?.querySelector(".auth-actions");
const authCopy = authPanel?.querySelector(".auth-copy");
const authLogo = authPanel?.querySelector(".auth-logo");
const authPage = document.querySelector(".auth-page");
const authForms = authPanel?.querySelectorAll(".auth-form");
const currentPlayerStorageKey = "metroDropCurrentPlayerId";
const currentPlayerCacheKey = "metroDropCurrentPlayerCache";
const getStoredCurrentPlayerId = () => safeStorage.get(currentPlayerStorageKey);
const setStoredCurrentPlayerId = (playerId) => {
	if (playerId) {
		safeStorage.set(currentPlayerStorageKey, playerId);
		return;
	}
	safeStorage.remove(currentPlayerStorageKey);
};
const getCachedCurrentPlayer = () => {
	const raw = safeStorage.get(currentPlayerCacheKey);
	if (!raw) {
		return null;
	}
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
};
const notifyPlayerStateChanged = (player) => {
	if (typeof window === "undefined") {
		return;
	}
	try {
		window.dispatchEvent(new CustomEvent("metrodrop:player-updated", { detail: player || null }));
	} catch {
	}
};
const setCachedCurrentPlayer = (player) => {
	if (!player) {
		safeStorage.remove(currentPlayerCacheKey);
		notifyPlayerStateChanged(null);
		return;
	}
	safeStorage.set(currentPlayerCacheKey, JSON.stringify(player));
	notifyPlayerStateChanged(player);
};
const getCurrentPlayer = async () => {
	const playerId = getStoredCurrentPlayerId();
	if (!playerId || !window.metroDropSupabase?.getPlayerById) {
		return null;
	}
	try {
		const player = await window.metroDropSupabase.getPlayerById(playerId);
		if (player) {
			setCachedCurrentPlayer(player);
			syncActiveCurrency(player);
			return player;
		}
		setStoredCurrentPlayerId(null);
		setCachedCurrentPlayer(null);
		return null;
	} catch {
		const cachedPlayer = getCachedCurrentPlayer();
		if (cachedPlayer) {
			syncActiveCurrency(cachedPlayer);
			return cachedPlayer;
		}
		return null;
	}
};
const getCurrentCurrencyMode = () => {
	const player = getCachedCurrentPlayer();
	if (player?.currency_mode) {
		return player.currency_mode === "uc" ? "uc" : "metro";
	}
	const savedMode = safeStorage.get(currencyStorageKey);
	if (savedMode === "uc" || savedMode === "metro") {
		return savedMode;
	}
	return "metro";
};
const setCurrentCurrencyMode = async (mode) => {
	const playerId = getStoredCurrentPlayerId();
	if (!playerId || !window.metroDropSupabase?.updatePlayer) {
		return null;
	}
	const nextMode = mode === "uc" ? "uc" : "metro";
	const player = getCachedCurrentPlayer() || await getCurrentPlayer();
	if (!player) {
		return null;
	}
	try {
		const result = await window.metroDropSupabase.updatePlayer(playerId, { currency_mode: nextMode });
		const updatedPlayer = Array.isArray(result) ? result[0] : result || { ...player, currency_mode: nextMode };
		setCachedCurrentPlayer(updatedPlayer);
		syncActiveCurrency(updatedPlayer);
		return updatedPlayer;
	} catch {
		return null;
	}
};
const refreshCurrentPlayerUi = async () => {
	const account = getCachedCurrentPlayer() || await getCurrentPlayer();
	if (!account) {
		return;
	}
	syncActiveCurrency(account);
	syncPlayerUiState(account);
	await renderHeaderBalance();
	if (typeof updateHomeCasePrices === "function") {
		updateHomeCasePrices();
	}
	if (typeof window.updateCaseActionPrice === "function") {
		window.updateCaseActionPrice();
	}
	if (typeof window.updateCaseItemPrices === "function") {
		window.updateCaseItemPrices();
	}
	if (typeof window.renderMissions === "function") {
		window.renderMissions();
	}
};

const renderHeaderBalance = async () => {
	const balanceCard = document.querySelector("[data-balance-card]");
	const balanceValue = document.querySelector("[data-balance]");
	const balanceCurrency = document.querySelector("[data-balance-currency]");
	const account = getCachedCurrentPlayer() || await getCurrentPlayer();
	const isLoggedIn = Boolean(account);

	if (!balanceCard || !balanceValue) {
		return;
	}

	if (!isLoggedIn || !account) {
		balanceCard.hidden = true;
		return;
	}

	const displayedBalance = activeCurrency === "uc" ? account.uc_balance : account.balance;
	balanceValue.textContent = activeCurrency === "uc"
		? String(Number(displayedBalance) || 0)
		: formatCurrencyValue(displayedBalance);
	if (balanceCurrency) {
		balanceCurrency.src = activeCurrency === "uc" ? "img/uc.png" : "img/metro_money.png";
		balanceCurrency.alt = activeCurrency === "uc" ? "UC" : "Метровалюты";
	}
	balanceCard.hidden = false;
};

const toggleCurrency = async () => {
	const account = getCachedCurrentPlayer() || await getCurrentPlayer();
	if (!account) {
		return;
	}
	activeCurrency = activeCurrency === "metro" ? "uc" : "metro";
	await setCurrentCurrencyMode(activeCurrency);
	await renderHeaderBalance();
	updateHomeCasePrices();
	if (typeof window.updateCaseActionPrice === "function") {
		window.updateCaseActionPrice();
	}
	if (typeof window.updateCaseItemPrices === "function") {
		window.updateCaseItemPrices();
	}
};

document.querySelector("[data-balance-card]")?.addEventListener("click", toggleCurrency);
document.querySelector("[data-balance-card]")?.addEventListener("keydown", (event) => {
	if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		toggleCurrency();
	}
});

const normalizePlayerName = (name) => {
	const trimmedName = String(name).trim();
	if (trimmedName && trimmedName === trimmedName.toUpperCase()) {
		return trimmedName.toLowerCase().replace(/^\S/, (character) => character.toUpperCase());
	}
	return trimmedName;
};

const syncPlayerUiState = (account) => {
	if (!account) {
		return;
	}

	const profileName = document.querySelector('[data-profile="name"]');
	const profileId = document.querySelector('[data-profile="id"]');
	const profileBalance = document.querySelector('[data-profile="balance"]');
	const profileTimeCards = document.querySelector('[data-profile="time-card"]');
	const profileUc = document.querySelector('[data-profile="uc"]');
	const profileAvatar = document.querySelector("[data-profile-avatar]");
	const workbenchTimeCards = document.querySelector(".time-card-header span");
	const timeCardsValue = Number.isFinite(Number(account.time_cards)) ? Number(account.time_cards) : 0;
	const ucValue = Number.isFinite(Number(account.uc_balance)) ? Number(account.uc_balance) : 0;
	const missionProgress = account.mission_progress && typeof account.mission_progress === "object" ? account.mission_progress : {};
	const savedStats = account.stats && typeof account.stats === "object" ? account.stats : {};
	const readGroupProgress = (keys) => Math.max(0, ...keys.map((key) => Number(missionProgress[key]) || 0), Number(missionProgress[keys[0].split("_")[0]]) || 0);
	const profileStats = {
		profit: Number(savedStats.profit ?? missionProgress.profit) || 0,
		cases: Number(savedStats.cases_opened ?? readGroupProgress(["cases_3", "cases_10", "cases_50"])) || 0,
		upgrades: Number(savedStats.upgrades_won ?? readGroupProgress(["upgrades_5", "upgrades_15", "upgrades_30"])) || 0
	};

	if (profileName) {
		profileName.textContent = normalizePlayerName(account.name);
	}
	if (profileAvatar) {
		profileAvatar.src = account.avatar || "img/logo.png";
		profileAvatar.classList.remove("is-pending");
	}
	if (profileId) {
		profileId.textContent = account.id;
	}
	if (profileBalance) {
		profileBalance.textContent = Number.isFinite(Number(account.balance)) ? account.balance : "0";
	}
	if (profileTimeCards) {
		profileTimeCards.textContent = String(timeCardsValue);
	}
	if (profileUc) {
		profileUc.textContent = String(ucValue);
	}
	if (workbenchTimeCards) {
		workbenchTimeCards.textContent = String(timeCardsValue);
	}
	document.querySelector('[data-profile-stat="profit"]')?.replaceChildren(document.createTextNode(String(profileStats.profit)));
	document.querySelector('[data-profile-stat="cases"]')?.replaceChildren(document.createTextNode(String(profileStats.cases)));
	document.querySelector('[data-profile-stat="upgrades"]')?.replaceChildren(document.createTextNode(String(profileStats.upgrades)));
};

const avatarTrigger = document.querySelector("[data-avatar-trigger]");
const avatarInput = document.querySelector("[data-avatar-input]");
const avatarImage = document.querySelector("[data-profile-avatar]");

avatarTrigger?.addEventListener("click", () => avatarInput?.click());
avatarInput?.addEventListener("change", async () => {
		const file = avatarInput.files?.[0];
		const player = getCachedCurrentPlayer() || await getCurrentPlayer();
		if (!file || !player?.id) {
			return;
		}
		if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
			avatarInput.value = "";
			alert("Выберите изображение размером не более 2 МБ.");
			return;
		}
		const reader = new FileReader();
		reader.addEventListener("load", async () => {
			const source = String(reader.result || "");
			const avatar = await new Promise((resolve) => {
				const image = new Image();
				image.addEventListener("load", () => {
					const size = 128;
					const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight, 1);
					const canvas = document.createElement("canvas");
					canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
					canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
					canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
					resolve(canvas.toDataURL("image/webp", 0.82));
				});
				image.addEventListener("error", () => resolve(source));
				image.src = source;
			});
			try {
				const result = await window.metroDropSupabase.updatePlayer(player.id, { avatar });
				const updatedPlayer = Array.isArray(result)
					? result[0] || { ...player, avatar }
					: result || { ...player, avatar };
				setCachedCurrentPlayer(updatedPlayer);
				if (avatarImage) {
					avatarImage.src = avatar;
				}
			} catch (error) {
				console.error("Failed to save avatar", error);
				alert("Не удалось сохранить аватар.");
			}
			avatarInput.value = "";
		});
		reader.readAsDataURL(file);
});

const settingsModal = document.querySelector("[data-settings-modal]");
const settingsForm = document.querySelector("[data-settings-form]");
const settingsMessage = document.querySelector("[data-settings-message]");
const passwordToggle = document.querySelector("[data-password-toggle]");
const passwordFields = document.querySelector("[data-password-fields]");
const settingsAccountFields = document.querySelector("[data-settings-account-fields]");
const setAccountFieldsVisible = (isVisible) => {
	if (settingsAccountFields) {
		settingsAccountFields.hidden = !isVisible;
	}
};
const setPasswordFieldsRequired = (isVisible) => {
	return isVisible;
};
const closeSettings = () => {
	if (settingsModal) {
		settingsModal.hidden = true;
	}
};

document.querySelector("[data-settings]")?.addEventListener("click", async () => {
	const player = getCachedCurrentPlayer() || await getCurrentPlayer();
	if (!player || !settingsForm || !settingsModal) {
		return;
	}
	settingsForm.elements.name.value = player.name || "";
	settingsForm.elements.id.value = player.id || "";
	settingsForm.elements.oldPassword.value = "";
	settingsForm.elements.newPassword.value = "";
	if (passwordFields) {
		passwordFields.hidden = true;
	}
	setPasswordFieldsRequired(false);
	setAccountFieldsVisible(true);
	if (passwordToggle) {
		passwordToggle.textContent = "СМЕНИТЬ ПАРОЛЬ";
	}
	if (settingsMessage) {
		settingsMessage.textContent = "";
		settingsMessage.className = "profile-settings-message";
	}
	settingsModal.hidden = false;
	settingsForm.elements.name.focus();
});

document.querySelector("[data-settings-close]")?.addEventListener("click", closeSettings);
passwordToggle?.addEventListener("click", () => {
	if (!passwordFields) {
		return;
	}
	passwordFields.hidden = !passwordFields.hidden;
	setAccountFieldsVisible(passwordFields.hidden);
	setPasswordFieldsRequired(!passwordFields.hidden);
	passwordToggle.textContent = passwordFields.hidden ? "СМЕНИТЬ ПАРОЛЬ" : "ВЕРНУТЬСЯ";
});
settingsModal?.addEventListener("click", (event) => {
	if (event.target === settingsModal) {
		closeSettings();
	}
});

settingsForm?.addEventListener("submit", async (event) => {
	event.preventDefault();
	const player = getCachedCurrentPlayer() || await getCurrentPlayer();
	if (!player) {
		return;
	}
	const name = normalizePlayerName(settingsForm.elements.name.value);
	const id = settingsForm.elements.id.value.trim();
	const oldPassword = settingsForm.elements.oldPassword.value;
	const newPassword = settingsForm.elements.newPassword.value;
	if (!name || !id) {
		if (settingsMessage) {
			settingsMessage.textContent = "Заполните ник и ID.";
			settingsMessage.className = "profile-settings-message is-error";
		}
		return;
	}
	const changingPassword = Boolean(passwordFields && !passwordFields.hidden);
	if (changingPassword && (!oldPassword || !newPassword || oldPassword !== player.password)) {
		if (settingsMessage) {
			settingsMessage.textContent = "Старый пароль указан неверно.";
			settingsMessage.className = "profile-settings-message is-error";
		}
		return;
	}
	const updates = { name, id };
	if (newPassword) {
		updates.password = newPassword;
	}
	try {
		const result = await window.metroDropSupabase.updatePlayer(player.id, updates);
		const updatedPlayer = Array.isArray(result)
			? result[0] || { ...player, ...updates }
			: result || { ...player, ...updates };
		setStoredCurrentPlayerId(updatedPlayer.id);
		setCachedCurrentPlayer(updatedPlayer);
		await restoreProfileData();
		if (settingsMessage) {
			settingsMessage.textContent = "Настройки сохранены.";
			settingsMessage.className = "profile-settings-message is-success";
		}
		window.setTimeout(closeSettings, 700);
	} catch (error) {
		console.error("Failed to save profile settings", error);
		if (settingsMessage) {
			settingsMessage.textContent = "Не удалось сохранить настройки.";
			settingsMessage.className = "profile-settings-message is-error";
		}
	}
});

const restoreProfileData = async () => {
	const account = getCachedCurrentPlayer() || await getCurrentPlayer();
	if (!account) {
		return;
	}

	syncPlayerUiState(account);
};

window.addEventListener("storage", async (event) => {
	if (!event.key) {
		return;
	}
	if (event.key === currentPlayerCacheKey || event.key === currentPlayerStorageKey || event.key === currencyStorageKey) {
		await refreshCurrentPlayerUi();
	}
});
window.addEventListener("metrodrop:player-updated", async (event) => {
	const player = event.detail || getCachedCurrentPlayer();
	if (!player) {
		return;
	}
	await refreshCurrentPlayerUi();
	window.setTimeout(() => {
		if (typeof renderInventory === "function") {
			renderInventory();
		}
	}, 0);
});

restoreProfileData();
renderHeaderBalance();

document.querySelector("[data-copy-id]")?.addEventListener("click", async (event) => {
	const id = document.querySelector('[data-profile="id"]')?.textContent;
	const message = event.currentTarget.parentElement.querySelector(".copy-message");

	if (!id) {
		return;
	}

	try {
		await navigator.clipboard.writeText(id);
		message.textContent = "ID скопирован";
	} catch {
		message.textContent = "Не удалось скопировать";
	}

	setTimeout(() => {
		message.textContent = "";
	}, 1600);
});

const showAuthMessage = (message, isError = false, form = null) => {
	const formMessage = form?.querySelector(".form-message");
	if (!formMessage) {
		return;
	}
	formMessage.textContent = message;
	formMessage.classList.toggle("is-error", isError);
};

const showAuthForm = (formId) => {
	if (!authChoice || !authForms) {
		return;
	}
	authChoice.hidden = true;
	authCopy.hidden = true;
	authLogo.hidden = true;
	authForms.forEach((form) => {
		if (form.dataset.authForm === formId) {
			form.removeAttribute("hidden");
			form.classList.add("is-visible");
		} else {
			form.setAttribute("hidden", "");
			form.classList.remove("is-visible");
		}
	});
	authForms.forEach((form) => showAuthMessage("", false, form));
	const firstInput = document.querySelector(`[data-auth-form="${formId}"] input`);
	firstInput?.focus();
};

const showAuthChoice = () => {
	if (!authChoice || !authForms) {
		return;
	}
	authChoice.hidden = false;
	authCopy.hidden = false;
	authLogo.hidden = false;
	authForms.forEach((form) => {
		form.setAttribute("hidden", "");
		form.classList.remove("is-visible");
	});
	authForms.forEach((form) => showAuthMessage("", false, form));
};

const closeAuthPage = () => {
	if (authPage) {
		authPage.hidden = true;
	}
};

const syncAuthNavigationState = (isLoggedIn) => {
	const authLinks = [...document.querySelectorAll(".login-button, .nav-link[href*='#login'], .nav-link[href*='home.html#login'], .mobile-menu-item[href*='#login'], .mobile-menu-item[href*='home.html#login']")];
	authLinks.forEach((link) => {
		const href = link.getAttribute("href") || "";
		const isAuthTarget = href.includes("#login") || href.includes("home.html#login");
		if (!isAuthTarget) {
			return;
		}
		if (isLoggedIn) {
			link.textContent = "ПРОФИЛЬ";
			link.href = "profile.html";
			return;
		}
		link.textContent = link.dataset.defaultText || link.textContent || "ВОЙТИ";
		link.href = href.includes("#login") ? href : "home.html#login";
	});
};

const restoreAuthState = async () => {
	document.querySelectorAll(".login-button, .nav-link[href*='#login'], .nav-link[href*='home.html#login'], .mobile-menu-item[href*='#login'], .mobile-menu-item[href*='home.html#login']").forEach((link) => {
		if (!link.dataset.defaultText) {
			link.dataset.defaultText = link.textContent.trim();
		}
	});
	const cachedPlayer = getCachedCurrentPlayer();
	if (cachedPlayer) {
		syncAuthNavigationState(true);
		closeAuthPage();
	}

	const player = await getCurrentPlayer();
	const isLoggedIn = Boolean(player);
	if (!isLoggedIn) {
		syncAuthNavigationState(false);
		return;
	}

	syncAuthNavigationState(true);
	closeAuthPage();
	void recordDailyLoginMission(player);
};

restoreAuthState();

document.querySelector("[data-logout]")?.addEventListener("click", () => {
	setStoredCurrentPlayerId(null);
	setCachedCurrentPlayer(null);
	safeStorage.remove("metroDropLoggedIn");
	safeStorage.remove(currencyStorageKey);
	syncAuthNavigationState(false);
	window.location.href = "home.html#login";
});

document.querySelectorAll("[data-auth-view]").forEach((button) => {
	button.addEventListener("click", () => showAuthForm(button.dataset.authView));
});

document.querySelectorAll(".form-back").forEach((button) => {
	button.addEventListener("click", showAuthChoice);
});

document.querySelector('input[name="id"]')?.addEventListener("input", (event) => {
	event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 11);
});

const playerNameInput = document.querySelector('input[name="name"]');
const validatePlayerName = () => {
	if (playerNameInput) {
		playerNameInput.setCustomValidity(
			/[A-Za-zА-Яа-яЁё]/.test(playerNameInput.value)
				? ""
				: "Имя игрока должно содержать хотя бы одну букву"
		);
	}
};

playerNameInput?.addEventListener("input", validatePlayerName);
validatePlayerName();

document.querySelectorAll(".auth-form").forEach((form) => {
	const submitButton = form.querySelector(".form-submit");
	const updateSubmitState = () => {
		submitButton.disabled = !form.checkValidity();
	};

	form.addEventListener("input", updateSubmitState);
	updateSubmitState();
});

document.querySelector('[data-auth-form="registration"]')?.addEventListener("submit", async (event) => {
	event.preventDefault();
	const formData = new FormData(event.currentTarget);
	const account = {
		name: normalizePlayerName(formData.get("name")),
		id: String(formData.get("id") || ""),
		password: String(formData.get("password") || ""),
		balance: 0,
		uc_balance: 0,
		time_cards: 0,
		currency_mode: "metro",
		inventory: []
	};

	if (!account.id || !account.name || !account.password) {
		showAuthMessage("Заполните все поля.", true, event.currentTarget);
		return;
	}

	try {
		const existingAccount = await window.metroDropSupabase.getPlayerById(account.id);
		if (existingAccount) {
			showAuthMessage("Такой ID уже зарегистрирован.", true, event.currentTarget);
			return;
		}
		const createdAccount = await window.metroDropSupabase.createPlayer(account);
		const savedPlayer = Array.isArray(createdAccount) ? createdAccount[0] : createdAccount;
		if (!savedPlayer) {
			showAuthMessage("Не удалось создать аккаунт.", true, event.currentTarget);
			return;
		}
		setStoredCurrentPlayerId(savedPlayer.id);
		setCachedCurrentPlayer(savedPlayer);
		sessionStorage.setItem("metroDropLoggedIn", "true");
		syncActiveCurrency(savedPlayer);
		syncAuthNavigationState(true);
		await renderHeaderBalance();
		await restoreProfileData();
		closeAuthPage();
		void recordDailyLoginMission(savedPlayer);
	} catch (error) {
		showAuthMessage("Ошибка регистрации. Попробуйте позже.", true, event.currentTarget);
	}
});

document.querySelector('[data-auth-form="login"]')?.addEventListener("submit", async (event) => {
	event.preventDefault();
	const formData = new FormData(event.currentTarget);
	const identifier = String(formData.get("identifier") || "");
	const password = String(formData.get("password") || "");

	if (!identifier || !password) {
		showAuthMessage("Введите логин и пароль.", true, event.currentTarget);
		return;
	}

	try {
		const account = await window.metroDropSupabase.loadPlayerByIdentifier(identifier);
		if (!account || (account.name !== identifier && account.id !== identifier) || account.password !== password) {
			showAuthMessage("Неверное имя игрока, ID или пароль.", true, event.currentTarget);
			return;
		}
		setStoredCurrentPlayerId(account.id);
		setCachedCurrentPlayer(account);
		sessionStorage.setItem("metroDropLoggedIn", "true");
		syncActiveCurrency(account);
		syncAuthNavigationState(true);
		await renderHeaderBalance();
		await restoreProfileData();
		closeAuthPage();
		void recordDailyLoginMission(account);
	} catch (error) {
		showAuthMessage("Ошибка входа. Попробуйте позже.", true, event.currentTarget);
	}
});

const getCurrentPlayerInventory = async () => {
	const currentPlayer = getCachedCurrentPlayer() || await getCurrentPlayer();
	if (!currentPlayer) {
		return [];
	}
	return Array.isArray(currentPlayer.inventory) ? currentPlayer.inventory : [];
};

const persistCurrentPlayerInventory = async (inventory) => {
	const playerId = getStoredCurrentPlayerId();
	if (!playerId || !window.metroDropSupabase?.updatePlayer) {
		return null;
	}
	try {
		const result = await window.metroDropSupabase.updatePlayer(playerId, { inventory });
		const updatedPlayer = Array.isArray(result) ? result[0] : result || getCachedCurrentPlayer();
		if (updatedPlayer) {
			setCachedCurrentPlayer(updatedPlayer);
		}
		return Array.isArray(updatedPlayer?.inventory) ? updatedPlayer.inventory : inventory;
	} catch {
		return inventory;
	}
};

const getMissionProgress = (player) => {
	const progress = player?.mission_progress;
	return progress && typeof progress === "object" && !Array.isArray(progress) ? progress : {};
};

const getClaimedMissions = (player) => {
	const claimed = getMissionProgress(player).__claimed;
	return claimed && typeof claimed === "object" ? claimed : {};
};

const missionGroups = {
	topups: ["topups_1"],
	cases: ["cases_3", "cases_10", "cases_50"],
	upgrades: ["upgrades_5", "upgrades_15", "upgrades_30"],
	contracts: ["contracts_3", "contracts_10", "contracts_30"],
	logins: ["logins_7"]
};

const missionCycleDuration = {
	daily: 24 * 60 * 60 * 1000,
	weekly: 7 * 24 * 60 * 60 * 1000,
	once: Infinity
};

const getMissionCycle = (entry) => entry.closest("[data-mission-cycle]")?.dataset.missionCycle || "once";
const isMissionClaimed = (claim, cycle) => {
	if (!claim) {
		return false;
	}
	if (claim === true) {
		return cycle === "once";
	}
	const claimedAt = Number(claim.claimedAt) || 0;
	return Date.now() - claimedAt < (missionCycleDuration[cycle] || Infinity);
};

const claimMission = async (entry) => {
	const player = getCachedCurrentPlayer() || await getCurrentPlayer();
	if (!player) {
		return false;
	}
	const key = entry.dataset.missionKey;
	const target = Math.max(1, Number(entry.dataset.missionTarget) || 1);
	const progress = { ...getMissionProgress(player) };
	const claimed = { ...getClaimedMissions(player) };
	const cycle = getMissionCycle(entry);
	const current = Number(progress[key] ?? progress[key.split("_")[0]]) || 0;
	if (current < target || isMissionClaimed(claimed[key], cycle)) {
		return false;
	}
	progress[key] = current;

	const rewardImage = entry.querySelector(".mission-reward img")?.getAttribute("src") || "";
	const rewardLabel = entry.querySelector(".mission-reward img")?.getAttribute("alt") || "Награда";
	const rewardText = entry.querySelector(".mission-reward strong")?.textContent || "";
	const claimedMissions = { ...claimed, [key]: { claimedAt: Date.now(), cycle } };
	const updates = {
		mission_progress: {
			...progress,
			__claimed: claimedMissions
		}
	};
	if (rewardImage.includes("money.png")) {
		const rewardAmount = Number(rewardText.replace(/[^0-9]/g, "")) || 0;
		updates.balance = (Number(player.balance) || 0) + rewardAmount;
		updates.mission_progress.profit = (Number(progress.profit) || 0) + rewardAmount;
		updates.stats = {
			...(player.stats || {}),
			profit: (Number(player.stats?.profit) || 0) + rewardAmount
		};
	} else if (rewardImage) {
		if (rewardImage.includes("workbench_ico.png")) {
			updates.mission_progress.workbench_ready = true;
		} else {
			updates.inventory = [
				...(Array.isArray(player.inventory) ? player.inventory : []),
				{ name: rewardLabel, image: rewardImage, rarity: "common", rarityLabel: "ОБЫЧНЫЙ" }
			];
		}
	}

	try {
		const result = await window.metroDropSupabase.updatePlayer(player.id, updates);
		const updatedPlayer = Array.isArray(result)
			? result[0] || { ...player, ...updates }
			: result || { ...player, ...updates };
		setCachedCurrentPlayer(updatedPlayer);
		return true;
	} catch (error) {
		console.error("Failed to claim mission reward", error);
		return false;
	}
};

const renderMissions = async () => {
	const missionEntries = document.querySelectorAll("[data-mission-key]");
	if (!missionEntries.length) {
		return;
	}
	const player = getCachedCurrentPlayer() || await getCurrentPlayer();
	const progress = getMissionProgress(player);
	const claimed = getClaimedMissions(player);
	missionEntries.forEach((entry) => {
		const key = entry.dataset.missionKey;
		const group = key.split("_")[0];
		const cycle = getMissionCycle(entry);
		const target = Math.max(1, Number(entry.dataset.missionTarget) || 1);
		const storedCurrent = progress[key] ?? progress[group];
		const claimedValue = claimed[key];
		const activeClaim = isMissionClaimed(claimedValue, cycle);
		const current = activeClaim
			? target
			: claimedValue && cycle !== "once"
				? 0
				: Math.min(target, Math.max(0, Number(storedCurrent) || 0));
		entry.hidden = activeClaim;
		if (activeClaim) {
			return;
		}
		let progressElement = entry.querySelector(".mission-progress");
		const description = entry.querySelector(":scope > span");
		let missionMeta = entry.querySelector(":scope > .mission-meta");
		if (!missionMeta && description) {
			missionMeta = document.createElement("div");
			missionMeta.className = "mission-meta";
			description.replaceWith(missionMeta);
			missionMeta.append(description);
		}
		if (!progressElement) {
			progressElement = document.createElement("div");
			progressElement.className = "mission-progress";
			if (missionMeta) {
				missionMeta.append(progressElement);
			} else {
				entry.append(progressElement);
			}
		}
		progressElement.hidden = false;
		progressElement.textContent = `${current} / ${target}`;
		const goButton = entry.querySelector(".mission-go-button:not(.mission-claim-button)");
		let claimButton = entry.querySelector(".mission-claim-button");
		if (!claimButton && goButton) {
			claimButton = document.createElement("button");
			claimButton.type = "button";
			claimButton.className = "mission-go-button mission-claim-button";
			claimButton.textContent = "ПОЛУЧИТЬ";
			claimButton.setAttribute("aria-label", "Получить награду");
			goButton.insertAdjacentElement("beforebegin", claimButton);
			claimButton.addEventListener("click", handleMissionClaimClick);
		}
		entry.classList.toggle("is-complete", current >= target);
		if (goButton) {
			goButton.textContent = "ПЕРЕЙТИ";
			goButton.hidden = current >= target;
		}
		if (claimButton) {
			const missionReady = current >= target;
			claimButton.hidden = !missionReady;
			claimButton.dataset.missionReady = String(missionReady);
		}
		progressElement.setAttribute("aria-label", `Прогресс: ${current} из ${target}`);
		if (claimedValue && cycle !== "once") {
			const remaining = (missionCycleDuration[cycle] || 0) - (Date.now() - (Number(claimedValue.claimedAt) || 0));
			if (remaining > 0) {
				window.setTimeout(() => window.renderMissions(), remaining + 50);
			}
		}
	});
};

window.renderMissions = renderMissions;
window.renderMissions();

document.querySelectorAll(".mission-claim-button").forEach((button) => {
button.addEventListener("click", handleMissionClaimClick);
});

async function handleMissionClaimClick(event) {
	const button = event.currentTarget;
	if (button.classList.contains("mission-claim-button") === false) {
		return;
	}
	{
		const entry = button.closest("[data-mission-key]");
		if (!entry || button.dataset.missionReady !== "true" || button.dataset.claiming === "true") {
			return;
		}
		event.preventDefault();
		const player = getCachedCurrentPlayer() || await getCurrentPlayer();
		const key = entry.dataset.missionKey;
		const target = Math.max(1, Number(entry.dataset.missionTarget) || 1);
		const progress = getMissionProgress(player);
		const claimed = getClaimedMissions(player);
		const cycle = getMissionCycle(entry);
		const current = Number(progress[key] ?? progress[key.split("_")[0]]) || 0;
		if (current < target || isMissionClaimed(claimed[key], cycle)) {
			return;
		}
		button.dataset.claiming = "true";
		const claimSucceeded = await claimMission(entry);
		delete button.dataset.claiming;
		if (claimSucceeded) {
			entry.hidden = true;
			rewardSound.currentTime = 0;
			rewardSound.play().catch(() => {});
			await renderMissions();
		}
	}
}

const recordMissionProgress = async (key, amount = 1) => {
	const player = getCachedCurrentPlayer() || await getCurrentPlayer();
	if (!player?.id || !window.metroDropSupabase?.updatePlayer) {
		return player;
	}
	const progress = { ...getMissionProgress(player) };
	const keys = missionGroups[key] || [key];
	const increment = Math.max(0, Number(amount) || 0);
	keys.forEach((missionKey) => {
		const entry = document.querySelector(`[data-mission-key="${missionKey}"]`);
		const cycle = entry ? getMissionCycle(entry) : "once";
		const claim = progress.__claimed?.[missionKey];
		const current = isMissionClaimed(claim, cycle) ? 0 : progress[missionKey] ?? progress[key] ?? 0;
		progress[missionKey] = Math.max(0, Number(current) || 0) + increment;
		if (claim && !isMissionClaimed(claim, cycle) && progress.__claimed) {
			const nextClaimed = { ...progress.__claimed };
			delete nextClaimed[missionKey];
			progress.__claimed = nextClaimed;
		}
	});
	try {
		const result = await window.metroDropSupabase.updatePlayer(player.id, { mission_progress: progress });
		const updatedPlayer = Array.isArray(result) ? result[0] : result || { ...player, mission_progress: progress };
		setCachedCurrentPlayer(updatedPlayer);
		return updatedPlayer;
	} catch (error) {
		console.error("Failed to save mission progress", error);
		return player;
	}
};

window.recordMissionProgress = recordMissionProgress;

const recordPlayerStat = async (key, amount = 1) => {
	const player = getCachedCurrentPlayer() || await getCurrentPlayer();
	if (!player?.id || !window.metroDropSupabase?.updatePlayer) {
		return player;
	}
	const stats = { ...(player.stats || {}) };
	stats[key] = (Number(stats[key]) || 0) + (Number(amount) || 0);
	try {
		const result = await window.metroDropSupabase.updatePlayer(player.id, { stats });
		const updatedPlayer = Array.isArray(result)
			? result[0] || { ...player, stats }
			: result || { ...player, stats };
		setCachedCurrentPlayer(updatedPlayer);
		return updatedPlayer;
	} catch (error) {
		console.error("Failed to save player stat", error);
		return player;
	}
};

window.recordPlayerStat = recordPlayerStat;

const recordDailyLoginMission = async (player) => {
	if (!player?.id || !window.metroDropSupabase?.updatePlayer) {
		return;
	}
	const today = new Date().toISOString().slice(0, 10);
	const progress = { ...getMissionProgress(player) };
	if (progress.__lastLoginDate === today) {
		return;
	}
	const nextProgress = { ...progress, __lastLoginDate: today };
	const keys = missionGroups.logins;
	keys.forEach((key) => {
		nextProgress[key] = (Number(nextProgress[key]) || 0) + 1;
	});
	try {
		const result = await window.metroDropSupabase.updatePlayer(player.id, { mission_progress: nextProgress });
		const updatedPlayer = Array.isArray(result)
			? result[0] || { ...player, mission_progress: nextProgress }
			: result || { ...player, mission_progress: nextProgress };
		setCachedCurrentPlayer(updatedPlayer);
	} catch (error) {
		console.error("Failed to save daily login mission", error);
	}
};

const renderInventory = async () => {
	const firstSlot = document.querySelector("[data-inventory-slot]");
	if (!firstSlot) {
		return;
	}
	const inventory = await getCurrentPlayerInventory();
	const inventoryGrid = firstSlot.parentElement;
	const requiredSlots = Math.max(12, inventory.length);
	while (inventoryGrid.children.length < requiredSlots) {
		const slot = document.createElement("div");
		slot.className = "inventory-slot";
		slot.dataset.inventorySlot = "";
		inventoryGrid.append(slot);
	}
	const inventorySlots = inventoryGrid.querySelectorAll("[data-inventory-slot]");

	inventorySlots.forEach((slot, index) => {
		const item = inventory[index];
		if (!item) {
			slot.replaceChildren();
			slot.className = "inventory-slot";
			return;
		}

		slot.className = `inventory-slot has-item rarity-${item.rarity || "common"}`;
		slot.innerHTML = `<img class="inventory-item-image" src="${item.image}" alt="${item.name}"><span class="inventory-rarity" aria-hidden="true"></span>`;
	});
};

const inventoryActionModal = document.querySelector("[data-inventory-action-modal]");
const inventoryActionPanel = document.querySelector(".inventory-action-panel");
const inventoryActionImage = document.querySelector("[data-inventory-action-image]");
const inventoryActionName = document.querySelector("[data-inventory-action-name]");
const inventoryActionPriceMetro = document.querySelector("[data-inventory-action-price-metro]");
const inventoryActionPriceUc = document.querySelector("[data-inventory-action-price-uc]");
const inventoryActionRarity = document.querySelector("[data-inventory-action-rarity]");
const inventoryActionDisassemble = document.querySelector('[data-inventory-action="disassemble"]');
const inventoryActionSell = document.querySelector('[data-inventory-action="sell"]');
const inventoryActionExchange = document.querySelector('[data-inventory-action="exchange"]');
let selectedInventoryIndex = null;

const closeInventoryAction = () => {
	if (inventoryActionModal) {
		inventoryActionModal.hidden = true;
	}
	selectedInventoryIndex = null;
};

const completeInventoryAction = async (action) => {
	const player = getCachedCurrentPlayer() || await getCurrentPlayer();
	if (!player || selectedInventoryIndex === null) {
		return;
	}
	const inventory = Array.isArray(player.inventory) ? [...player.inventory] : [];
	const item = inventory[selectedInventoryIndex];
	if (!item) {
		closeInventoryAction();
		return;
	}
	const isWorkbench = item.image?.includes("workbench_ico.png");
	if (isWorkbench && action !== "disassemble") {
		return;
	}
	if (action === "disassemble" && item.image?.includes("workbench_ico.png")) {
		const missionProgress = { ...(player.mission_progress || {}), workbench_ready: true };
		const updates = {
			inventory: inventory.filter((_, index) => index !== selectedInventoryIndex),
			mission_progress: missionProgress
		};
		try {
			const result = await window.metroDropSupabase.updatePlayer(player.id, updates);
			setCachedCurrentPlayer(Array.isArray(result) ? result[0] : result || { ...player, ...updates });
			closeInventoryAction();
			playClickSound();
			navigateWithMenuClose("workbench.html", verstakNavigationKey);
		} catch (error) {
			console.error("Failed to prepare workbench item", error);
		}
		return;
	}
	const itemPrice = Math.max(0, Number(item.price) || 0);
	const updates = { inventory: inventory.filter((_, index) => index !== selectedInventoryIndex) };
	if (action === "sell") {
		updates.balance = (Number(player.balance) || 0) + itemPrice;
	} else {
		const ucReward = Math.round(itemPrice / metroToUcRate);
		updates.uc_balance = (Number(player.uc_balance) || 0) + ucReward;
	}
	try {
		const result = await window.metroDropSupabase.updatePlayer(player.id, updates);
		const updatedPlayer = Array.isArray(result)
			? result[0] || { ...player, ...updates }
			: result || { ...player, ...updates };
		setCachedCurrentPlayer(updatedPlayer);
		closeInventoryAction();
		await renderInventory();
	} catch (error) {
		console.error("Failed to process inventory item", error);
	}
};

document.querySelector("[data-inventory-sell-all]")?.addEventListener("click", async () => {
	const player = getCachedCurrentPlayer() || await getCurrentPlayer();
	const inventory = Array.isArray(player?.inventory) ? player.inventory : [];
	if (!player || !inventory.length || !window.confirm("Продать все предметы из инвентаря?")) {
		return;
	}
	const totalPrice = inventory.reduce((sum, item) => sum + Math.max(0, Number(item.price) || 0), 0);
	try {
		const updates = {
			inventory: [],
			balance: (Number(player.balance) || 0) + totalPrice
		};
		const result = await window.metroDropSupabase.updatePlayer(player.id, updates);
		const updatedPlayer = Array.isArray(result)
			? result[0] || { ...player, ...updates }
			: result || { ...player, ...updates };
		setCachedCurrentPlayer(updatedPlayer);
		await renderInventory();
	} catch (error) {
		console.error("Failed to sell all inventory items", error);
	}
});

document.querySelector("[data-inventory-action-close]")?.addEventListener("click", closeInventoryAction);
inventoryActionModal?.addEventListener("click", (event) => {
	if (event.target === inventoryActionModal) {
		closeInventoryAction();
	}
});
document.querySelectorAll("[data-inventory-action]").forEach((button) => {
	button.addEventListener("click", () => completeInventoryAction(button.dataset.inventoryAction));
});
document.querySelector(".inventory-grid")?.addEventListener("click", (event) => {
	const slot = event.target.closest("[data-inventory-slot]");
	if (!slot?.classList.contains("has-item") || !inventoryActionModal) {
		return;
	}
	selectedInventoryIndex = Number([...slot.parentElement.querySelectorAll("[data-inventory-slot]")].indexOf(slot));
	const item = getCachedCurrentPlayer()?.inventory?.[selectedInventoryIndex];
	if (!item) {
		return;
	}
	const metroPrice = Number(item.price) || 0;
	const ucPrice = metroPrice / metroToUcRate;
	const rarity = typeof item.rarity === "string" && item.rarity ? item.rarity : "common";
	inventoryActionImage.src = item.image;
	inventoryActionImage.alt = item.name || "Предмет";
	inventoryActionName.textContent = item.name || "Предмет";
	if (inventoryActionDisassemble) {
		const isWorkbench = item.image?.includes("workbench_ico.png");
		inventoryActionDisassemble.hidden = !isWorkbench;
		if (inventoryActionSell) inventoryActionSell.hidden = isWorkbench;
		if (inventoryActionExchange) inventoryActionExchange.hidden = isWorkbench;
	}
	if (inventoryActionPanel) {
		inventoryActionPanel.classList.remove("rarity-common", "rarity-rare", "rarity-epic", "rarity-blue", "rarity-pink", "rarity-red", "rarity-gold");
		inventoryActionPanel.classList.add(`rarity-${rarity}`);
	}
	if (inventoryActionPriceMetro) {
		inventoryActionPriceMetro.textContent = new Intl.NumberFormat("ru-RU").format(Math.round(metroPrice));
	}
	if (inventoryActionPriceUc) {
		inventoryActionPriceUc.textContent = ucPrice.toFixed(2).replace(/\.00$/, "");
	}
	if (inventoryActionRarity) {
		inventoryActionRarity.style.display = "block";
	}
	inventoryActionModal.hidden = false;
});

const selectedContractItemIndexes = new Set();
const contractSubmitButton = document.getElementById("contractSubmitButton");
const contractCardsWrap = document.querySelector(".contract-cards");
const contractLogo = document.querySelector(".contract-logo");
const contractReward = document.querySelector(".contract-reward");
let isContractAnimationRunning = false;

const updateContractSubmitButtonState = () => {
	if (!contractSubmitButton) return;

	const isReady = selectedContractItemIndexes.size >= 4;
	contractSubmitButton.disabled = !isReady;
	contractSubmitButton.setAttribute("aria-disabled", String(!isReady));
	contractSubmitButton.classList.toggle("is-disabled", !isReady);
};

const triggerContractCollectionAnimation = async () => {
	if (!contractCardsWrap || isContractAnimationRunning) return;
	const inventory = await getCurrentPlayerInventory();
	const selectedIndexes = new Set(selectedContractItemIndexes);
	const selectedItems = Array.from(selectedIndexes)
		.map((index) => inventory[index])
		.filter(Boolean);
	if (!selectedItems.length) return;
	const selectedTotal = selectedItems.reduce((total, item) => total + Math.max(0, Number(item.price) || 0), 0);
	if (!selectedTotal) return;
	const state = await window.metroDropSupabase.load();
	const siteItems = (state.cases || []).flatMap((caseItem) => (caseItem.contents || []).map((item) => typeof item === "string"
		? { name: item, image: caseItem.image, price: caseItem.price, rarity: "common", rarityLabel: "ОБЫЧНЫЙ" }
		: item)).filter((item) => item?.image && Number(item.price) > 0);
	if (!siteItems.length) return;
	const targetPrice = selectedTotal * (Math.random() < 0.5 ? 0.5 : 2);
	const eligibleItems = siteItems.filter((item) => Number(item.price) >= selectedTotal * 0.5 && Number(item.price) <= selectedTotal * 2);
	const rewardPool = eligibleItems.length ? eligibleItems : siteItems;
	const rewardItem = [...rewardPool].sort((left, right) => Math.abs(Number(left.price) - targetPrice) - Math.abs(Number(right.price) - targetPrice))[0];

	isContractAnimationRunning = true;
	contractCardsWrap.classList.remove("is-animating");
	void contractCardsWrap.offsetWidth;
	contractCardsWrap.classList.add("is-animating");
	window.setTimeout(async () => {
		contractCardsWrap.classList.add("is-resetting");
		contractCardsWrap.classList.remove("is-animating");
		void contractCardsWrap.offsetWidth;
		window.requestAnimationFrame(() => {
			contractCardsWrap.classList.remove("is-resetting");
		});

		const remainingItems = inventory.filter((item, index) => !selectedIndexes.has(index));
		remainingItems.push({
			...rewardItem,
			price: Number(rewardItem.price) || 0,
			rarity: rewardItem.rarity || "common",
			rarityLabel: rewardItem.rarityLabel || "ОБЫЧНЫЙ"
		});
		await persistCurrentPlayerInventory(remainingItems);
		await recordMissionProgress("contracts", 1);
		selectedContractItemIndexes.clear();
		activeContractCardIndex = null;
		renderContractCardAssignments();
		renderContractInventory();
		if (contractLogo && contractReward) {
			contractLogo.hidden = true;
			contractReward.src = rewardItem.image;
			contractReward.alt = rewardItem.name || "Предмет контракта";
			contractReward.hidden = false;
		}
		isContractAnimationRunning = false;
	}, 2000);
};

const renderContractInventory = async () => {
	const grid = document.getElementById("contractInventoryGrid");
	if (!grid) return;

	const inventory = await getCurrentPlayerInventory();
	grid.querySelectorAll(".inventory-slot").forEach((slot, index) => {
		const item = inventory[index];
		slot.replaceChildren();
		slot.dataset.itemIndex = String(index);
		slot.classList.remove("has-item", "rarity-epic", "is-selected", "is-picked");
		slot.setAttribute("aria-pressed", "false");

		if (!item) return;

		slot.classList.add("has-item", `rarity-${item.rarity}`);
		if (selectedContractItemIndexes.has(index)) {
			slot.classList.add("is-selected", "is-picked");
			slot.setAttribute("aria-pressed", "true");
			slot.style.display = "none";
			return;
		}

		slot.style.display = "";

		const image = document.createElement("img");
		image.className = "inventory-item-image";
		image.src = item.image;
		image.alt = item.name || "Предмет";
		slot.append(image);

		const rarity = document.createElement("span");
		rarity.className = "inventory-rarity";
		slot.append(rarity);
	});

	updateContractSubmitButtonState();
};

const contractInventoryPicker = document.getElementById("contractInventoryPicker");
const contractPage = document.querySelector(".contract-page");
const contractCards = document.querySelectorAll(".contract-card");
let activeContractCardIndex = null;

const renderContractCardAssignments = async () => {
	if (!contractCards.length) return;

	const inventory = await getCurrentPlayerInventory();
	const assignedItems = Array(contractCards.length).fill(null);
	const selectedItems = Array.from(selectedContractItemIndexes)
		.map((slotIndex) => inventory[slotIndex])
		.filter(Boolean);

	if (activeContractCardIndex !== null) {
		selectedItems.forEach((item, offset) => {
			const cardIndex = (activeContractCardIndex + offset) % contractCards.length;
			assignedItems[cardIndex] = item;
		});
	}

	contractCards.forEach((card, index) => {
		card.replaceChildren();
		const item = assignedItems[index];
		if (item) {
			const image = document.createElement("img");
			image.src = item.image;
			image.alt = item.name || "Предмет";
			card.append(image);
		}

		card.classList.toggle("has-item", Boolean(item));
		card.setAttribute("aria-label", item ? `Предмет контракта: ${item.name}` : `Предмет контракта ${index + 1}`);
	});
};

const closeContractInventory = () => {
	if (!contractInventoryPicker) return;
	contractInventoryPicker.classList.remove("is-open");
	contractInventoryPicker.setAttribute("aria-hidden", "true");
	contractCards.forEach((card) => card.classList.remove("is-selected"));
};

const resetContractSelection = () => {
	selectedContractItemIndexes.clear();
	if (!contractInventoryPicker) return;
	contractInventoryPicker.querySelectorAll(".inventory-slot").forEach((slot) => {
		slot.classList.remove("is-selected");
		slot.setAttribute("aria-pressed", "false");
	});
	updateContractSubmitButtonState();
	renderContractCardAssignments();
};

contractInventoryPicker?.addEventListener("click", (event) => {
	event.stopPropagation();
	const slot = event.target.closest(".inventory-slot");
	if (!slot || !slot.classList.contains("has-item")) return;

	const index = Number(slot.dataset.itemIndex);
	if (Number.isNaN(index)) return;

	if (selectedContractItemIndexes.has(index)) {
		selectedContractItemIndexes.delete(index);
		slot.classList.remove("is-selected", "is-picked");
		slot.style.display = "";
		slot.setAttribute("aria-pressed", "false");
		updateContractSubmitButtonState();
		renderContractCardAssignments();
		renderContractInventory();
		return;
	}

	selectedContractItemIndexes.add(index);
	slot.classList.add("is-selected", "is-picked");
	slot.setAttribute("aria-pressed", "true");
	updateContractSubmitButtonState();
	renderContractCardAssignments();
	renderContractInventory();
});

contractCards.forEach((card, index) => {
	card.dataset.contractCardIndex = String(index);
	card.addEventListener("click", (event) => {
		event.stopPropagation();
		if (contractLogo && contractReward) {
			contractLogo.hidden = false;
			contractReward.hidden = true;
		}
		const isOpen = contractInventoryPicker?.classList.contains("is-open");
		const isSameCard = card.classList.contains("is-selected");

		contractCards.forEach((item) => item.classList.remove("is-selected"));
		if (isOpen && isSameCard) {
			closeContractInventory();
			return;
		}

		activeContractCardIndex = index;
		resetContractSelection();
		card.classList.add("is-selected");
		if (!contractInventoryPicker) return;
		renderContractInventory();
		contractInventoryPicker.classList.add("is-open");
		contractInventoryPicker.setAttribute("aria-hidden", "false");
	});
});

contractSubmitButton?.addEventListener("click", (event) => {
	event.preventDefault();
	event.stopPropagation();
	if (contractSubmitButton.disabled) return;
	triggerContractCollectionAnimation();
});

window.addEventListener("click", (event) => {
	if (!contractInventoryPicker || !contractPage || isContractAnimationRunning) return;
	if (!contractPage.contains(event.target)) {
		closeContractInventory();
	}
});

const giveEpicBackpack = async () => {
	const inventory = await getCurrentPlayerInventory();
	if (!inventory.some((item) => item.image === "items/backpack_4.png")) {
		const updatedInventory = [...inventory, {
			name: "РЮКЗАК",
			image: "items/backpack_4.png",
			rarity: "epic",
			rarityLabel: "ЭПИЧЕСКИЙ"
		}];
		await persistCurrentPlayerInventory(updatedInventory);
	}

	if (document.querySelector("[data-inventory-slot]")) {
		await renderInventory();
	} else {
		window.location.href = "profile.html";
	}
};

renderInventory();