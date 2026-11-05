'use strict';
/**
 * cluster_logo.js - G's Dash's logo in the instrument cluster's central map area while G's Dash is open
 * and no route guidance runs ("Logo in cluster when not navigating"), through the separately installed
 * "Cluster renderer" tool (cluster-render, robertnisipeanu/idrive-apps, from the Store).
 *
 * The rule (0.7.5): the logo shows unless route guidance is active or G's TV is drawing. It is one
 * "content" layer at z NAV_Z (50), contending: over a free-drive map (Waze on cluster's CarPlay map,
 * content z 0; it takes the slot over from the stock map, the service's own take-over: the HMI's map
 * parks behind it and is back when the logo goes); under G's TV (content z 100, exclusive: a video
 * played in the cluster on purpose always wins, and the logo is hidden while G's TV draws). Route
 * guidance (NavigationStatus.guidingState ACTIVE, CarPlay's or Android Auto's projectedGuidanceActive,
 * fed in by main.js through guidance()) active for GUIDE_ON_MS: hidden (visible 0: Waze's map under it
 * shows at once, the slot goes back to the stock map); off for GUIDE_OFF_MS: back. Another app's layer
 * being there (Waze's included, drawing or not) never hides it: the renderer cannot tell what is on the
 * glass (Waze on cluster sends CarPlay's empty picture while the phone shows no map, its layer "shown",
 * the area empty). With no guidance signal answering, the logo still shows ("Shown - route detection
 * unavailable"): during CarPlay route guidance it then covers Waze's turn-by-turn map, and the setting
 * turns it off. Which signal answers: guideLink() (main.js's watch results) and routeLine()
 * ("Route: nav n/a · CarPlay off · AA n/a"), on the Cluster logo page and in the log.
 *
 * Written for G's Dash from the tool's PROTOCOL.md and README, the way G's TV talks to it; it contains
 * none of the tool's code. The tool's own Node client is loaded at run time from where the tool
 * installs it, and only when that file and its directory are owned by root and writable by nobody
 * else (NG_CR_CLIENT / NG_CR_SOCK: a test client and socket, which skip that check):
 *     /var/opt/cluster-render/current/cluster_render_client.js
 *
 * The layer: one "image" layer on the "map" target only (slot 0x100, 1088x480, between the dials),
 * class "content" at z 50 (above Waze on cluster's CarPlay map, content z 0; under G's TV, content
 * z 100), contending (the stock map parks behind it), never exclusive, never "alert", never the panel or the HUD. The image is sent once: the regular logo (the badge's own
 * geometry, 448x240 on black, drawn 1:1 in the middle of the map area: 430 KB once), or with the Pixel
 * look the pixel-art emblem at its cell grid (27x15, 1.6 KB) drawn 16x by the cluster's GPU with
 * nearest sampling, so it stays crisp. A look change between the two sends the other image once (the
 * new layer first, then the old one goes). An image layer never stalls (stall_ms is for video only; an
 * image is drawn from its last pixels for as long as the layer exists), so nothing is sent to keep it
 * up: after the image, 0 bytes a second. The fade-in is the service's own (250 ms when the target is
 * shown). Only with the Pixel look and only while the car stands still: the emblem's stripes slide in
 * once and a shine crosses it every few seconds, as on the dash (whole 1.6 KB images, at most 12 a
 * second while a sweep runs: about 4 KB/s); moving, it is one still image and nothing more is sent.
 *
 * Whether the map area is in use (the service's own reports, nothing guessed):
 *   - other clients' layers on the map (only G's TV's hides the logo, 0.7.5): the service's "status" text lists every client's layers
 *     ("layer N KIND of APP on TARGET, CLASS z Z: STATE[ - REASON]", then "  STATS": a video layer's
 *     "N sent, ...", an image layer's "N writes, ..."); asked for once a second over the local socket
 *     (nothing goes to the cluster). Only a layer that is actually drawing counts (drawing()):
 *       shown      the service draws it (visible, content within its own stall window, its target
 *                  shown): in use. A video layer that never sent a frame does not count.
 *       waiting /  visible but not drawn yet (target not shown or taken, under an alert): in use only
 *       suspended  while its frame counter is advancing (it moved within FRESH_MS), i.e. frames are
 *                  arriving and it draws as soon as the target is shown.
 *       stalled    visible but no content (no frame yet, or its frames stopped), hidden, error: idle.
 *     Waze on cluster makes its video layer as soon as it reaches the service and keeps it visible
 *     while CarPlay's cluster stream connection is up, frames or not: with CarPlay not streaming that
 *     layer is "stalled" (or "hidden"), registered but idle; drawing or not, it never hides the logo,
 *     which is over it. While G's TV's layer is drawing, ours is hidden (visible 0: it does not want
 *     the slot), and it comes back HOLD_MS after G's TV stopped.
 *   - the stock map (the HMI's own content in slot 0x100): our target's events say it ("parked" or
 *     "waiting", holder "stock"); the logo contends, so the service takes the slot over (the stock
 *     HMI's content only, at most every 3, then 10 s; the HMI's mapping parks behind ours and comes
 *     back when the logo goes). A contending app's take-over (G's TV) leaves the HMI's content parked
 *     behind it and shown again when it goes; the logo, contending too, takes it over again.
 *   - kept up (_tick, every POLL_MS while open): a connection that is not ready for RECONNECT_MS is
 *     made again; our layer missing from the service's list (once it was listed) or in error is made
 *     again (the image sent again); the client itself re-makes it whole after a reconnect.
 *   - after our slot was lost (a door-open warning or a phone reconnecting locks the slot and the
 *     KOMBI unmaps everything; the first to ask afterwards is shown) the logo waits YIELD_MS before
 *     asking again, so the HMI's map goes first.
 *   Not visible to a client: the stock map mapped AFTER the logo was shown (the user turns the cluster
 *   to Map view while G's Dash is open). The KOMBI never takes a slot from what it shows, so the stock
 *   map then waits behind the logo until G's Dash is closed or hidden (or the setting is turned off).
 *
 * 0.13.1, the look's own G (logo_core.js): with a shader look (M, GT, Digital '84, SimRacing, Lumen) the
 * logo is one "effect" layer at the same place (map, content z 50, contending): its fragment shader draws
 * that look's G, still (no u_time, no uniforms: the renderer stages and flushes nothing after it is made),
 * 0 bytes of the renderer's pixel budget. Fallbacks, in order: no effect layers in the client, the effect
 * refused, or its layer in error (did not compile) -> the look's baked picture logo_<look>.png (448x240,
 * 0.82 MiB budget, only the active look's ever loaded) -> the regular logo. Pixel: the emblem, as before.
 * A look change: to or from an effect, the new layer is made, then the old dropped (an effect holds no
 * pictures, so no two pictures are ever in memory together); picture to picture, the old is dropped first,
 * then a status asked, and the new made only once the renderer answered and FREE_MS passed (0.12.1's gate);
 * a change waits SETTLE_MS so stepping through looks makes one layer. Never animated while driving.
 *
 * Off at once: hidden, closed, the setting off -> the layer is dropped (the service removes it at
 * once, no fade) and the connection closed; when the app ends its socket closes and the service
 * removes its layers. Never throws, never blocks. Node 8: no ?., ?? or object spread.
 */
const MEM = require('./cluster_memory');
const CORE = require('./logo_core');
// the tool's client and its status text, read as G's Music and G's TV read them (also exported from here)
const { loadClient, trusted, mapLayers, ownLayers, drawing, guideValue, FRESH_MS } = require('./kit/cluster_render');

const TARGET = 'map', MAP_W = 1088, MAP_H = 480;      // the only target used
const LOGO_W = 448, LOGO_H = 240, BADGE_H = 184;     // the regular logo, 1:1
// TNM fork: the owner's own logo (images/logo_custom.png) in every look, as a baked picture;
// 672x160 is the same pixel count (and renderer budget) as the 448x240 logo, wider for a wordmark
const CUSTOM = 'custom', CUSTOM_W = 672, CUSTOM_H = 160;
const CELL = 16;                                     // the pixel emblem's cell on the cluster
const FPS_STILL = 1, FPS_ANIM = 12;                  // the image's write ceiling (fps: writes a second at most)
const POLL_MS = 1000, HOLD_MS = 3000, YIELD_MS = 3000, LOAD_RETRY_MS = 30000;
const NAV_KLASS = 'content', NAV_Z = 50;             // "not navigating": over Waze's map (z 0), under G's TV (z 100)
const GUIDE_ON_MS = 1000, GUIDE_OFF_MS = 3000;       // guidance on this long: hidden; off this long: back
const RECONNECT_MS = 8000, REMAKE_MS = 2000, ERR_RETRY_MS = 5000, ERR_RETRIES = 3;
const ANIM_MS = 80;                                  // the parked animation's step
const FX_BAD = /compile|link|shader|effect|unsupported|unknown/i;   // a layer error that rules the look's shader out
const SHINE_EVERY = 4200, SHINE_MS = 700, INTRO_MS = 1100;

/* ----- the images ----- */

function hex(c) {
    if (Array.isArray(c)) return [c[0] | 0, c[1] | 0, c[2] | 0, c.length > 3 ? c[3] | 0 : 255];
    const s = String(c).replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16), 255];
}
/** A tiny pixel-exact raster (cell edges rounded, no smoothing) for the emblem at 1 px a cell. */
function cellRaster(w, h) {
    const d = Buffer.alloc(w * h * 4);
    for (let i = 3; i < d.length; i += 4) d[i] = 255;           // black, opaque
    return {
        w, h, d,
        fillRect(x, y, rw, rh, c) {
            const v = hex(c), a = v[3] / 255;
            const x0 = Math.max(0, Math.round(x)), x1 = Math.min(w, Math.round(x + rw));
            const y0 = Math.max(0, Math.round(y)), y1 = Math.min(h, Math.round(y + rh));
            for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
                const o = (yy * w + xx) * 4;
                for (let k = 0; k < 3; k++) d[o + k] = Math.round(d[o + k] * (1 - a) + v[k] * a);
                d[o + 3] = 255;
            }
        },
    };
}
/** The Pixel look's emblem (px.js), one image per motion state: { w, h, d }. o: px.emblem's options. */
function pixelImage(P, o) {
    const r = cellRaster(P.EMB.w, P.EMB.h);
    P.emblem(r, 0, 0, 1, o || {});
    return r;
}
/** The regular logo: the badge (lib.js) centred on black, LOGO_W x LOGO_H. */
function regularImage(Canvas, badge, badgeWidth) {
    const cv = new Canvas(LOGO_W, LOGO_H);
    cv.clear('#000000');
    const bw = badgeWidth(BADGE_H);
    badge(cv, Math.round((LOGO_W - bw) / 2), Math.round((LOGO_H + BADGE_H) / 2), BADGE_H);
    const d = Buffer.from(cv.d.buffer, cv.d.byteOffset, cv.d.length);
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    return { w: LOGO_W, h: LOGO_H, d };
}
/** Where an image goes on the map: the logo 1:1, the emblem CELL x, both centred. */
function placement(kind, img) {
    const s = kind === 'pixel' ? CELL : 1, w = img.w * s, h = img.h * s;
    return { x: Math.round((MAP_W - w) / 2), y: Math.round((MAP_H - h) / 2), w, h };
}

/** A guidance value as routeLine() says it: nav 'inactive' / 'calculating' / 'active', else 'on' / 'off', '?' */
function rawText(src, v, g) {
    if (g === null) return '?';
    if (src !== 'nav') return g ? 'on' : 'off';
    if (g) return 'active';
    const n = typeof v === 'object' && v ? v[Object.keys(v)[0]] : v;
    return n === 1 || n === '1' || /^CALCULATING/i.test(String(n)) ? 'calculating' : 'inactive';
}

/** A short name for an app id in the Options line. */
function appName(app) {
    const a = String(app || '');
    if (/waze/i.test(a)) return 'Waze';
    if (a === 'ng_tv') return 'G\'s TV';
    return a.length > 14 ? a.slice(0, 13) + '.' : a;
}

/* ----- the logo ----- */

class ClusterLogo {
    /**
     * opts: log, app ('ng_gsdash'), images: { regular() -> {w,h,d}, pixel(o) -> {w,h,d} }, client /
     * sock / testing (tests), now(), timers ({ setInterval, clearInterval, setTimeout, clearTimeout }).
     */
    constructor(opts) {
        const o = opts || {};
        this.o = o;
        this.log = o.log || { info() {}, warn() {} };
        this.app = o.app || 'ng_gsdash';
        this.now = o.now || Date.now;
        this.T = o.timers || { setInterval, clearInterval };
        this.images = o.images;
        this.want = false; this.pixel = false; this.look = '';
        this.fxBad = {}; this.bakedBad = {};               // looks whose shader / baked picture failed (this run)
        this.gate = new MEM.FreeGate(this.now); this.asked = 0; this.answered = 0; this.lookAt = -1e15; this.wantKey = ''; this.parked = false; this.enabled = true;
        this._reset();
        this.err = null; this.errAt = -1e15;
        this.guide = { nav: null, carplay: null, aa: null }; // the car's guidance signals: null = no answer yet
        this.link = { nav: '', carplay: '', aa: '' };       // the signals' watch: '' not yet, 'error', 'down', 'up'
        this.rawText = { nav: '', carplay: '', aa: '' };    // their last values, as routeLine() says them
        this.lastRoute = '';
        this.rawGuide = false; this.rawSince = this.now(); this.guiding = false;
        this.stats = { layers: 0, sends: 0, bytes: 0, drops: 0, polls: 0, remakes: 0, reconnects: 0 };
    }
    _reset() {
        this.cr = null; this.ready = false; this.ref = 0; this.kind = ''; this.key = '';
        if (this.gate) this.gate.reset(); this.asked = 0; this.answered = 0; this.visible = null;
        this.polled = false; this.others = []; this.under = []; this.idle = []; this.seen = {}; this.lastBusy = ''; this.busyAt = -1e15; this.yieldUntil = -1e15;
        this.target = { state: '', holder: '', reason: '', rendering: '' };
        this.layerState = ''; this.refused = '';
        this.frameKey = ''; this.animAt = 0; this.shownAt = 0;
        this.poll = null; this.anim = null;
        this.downAt = this.now(); this.madeAt = 0; this.ownSeen = false; this.ownMissing = 0; this.errRetries = 0; this.errAt2 = 0;
        this.contend = false;
    }

    /**
     * What G's Dash wants, from its loop and its visibility and setting handlers (idempotent):
     * on: G's Dash open and the setting on; pixel: the Pixel look; parked: the car stands still.
     */
    update(s) {
        const on = !!(s && s.on);
        this.enabled = !(s && s.enabled === false);
        this.idleText = (s && typeof s.idleText === 'string') ? s.idleText : '';   // the line while not wanted (0.8.3: the Cluster source pick)
        this.look = (s && typeof s.look === 'string') ? s.look : '';
        this.pixel = !!(s && s.pixel) || this.look === 'pixel';
        this.parked = !!(s && s.parked);
        if (!on) { if (this.want || this.cr) this._off(); this.want = false; return; }
        this.want = true;
        if (!this.cr) this._connect();
        this._apply();
    }

    _connect() {
        const now = this.now();
        if (this.err && now - this.errAt < LOAD_RETRY_MS) return;
        const c = loadClient(this.o);
        if (c.error) {
            if (!this.err || this.err.error !== c.error) this.log.warn('cluster logo: ' + c.text + (c.detail ? ' (' + c.detail + ')' : ''));
            this.err = c; this.errAt = now;
            return;
        }
        this.err = null;
        const cr = this.cr = new c.ClusterRender(this.app, c.sock);
        cr.on('ready', () => { if (this.cr !== cr) return; this.ready = true; this.log.info('cluster logo: connected'); this._ask(); });
        cr.on('disconnected', () => {
            if (this.cr !== cr) return;
            // the client reconnects and makes our layer again whole; until then nothing here is known
            this.ready = false; this.polled = false; this.downAt = this.now(); this.ownSeen = false; this.ownMissing = 0;
            this.target = { state: '', holder: '', reason: '', rendering: '' };
            this.log.info('cluster logo: disconnected');
        });
        cr.on('layer', (ref, state, reason) => {
            if (this.cr !== cr || ref !== this.ref) return;
            if (state === 'shown' && this.layerState !== 'shown') this.shownAt = this.now();
            if (state === 'error' && this.layerState !== 'error') this.errAt2 = this.now();
            this.layerState = state || '';
            if (state === 'error') this.log.warn('cluster logo: layer error' + (reason ? ' (' + reason + ')' : ''));
            if (state === 'error' && this.kind === 'fx' && (!reason || FX_BAD.test(reason))) this._fxFailed('layer error' + (reason ? ' (' + reason + ')' : ''));
        });
        // the target event's "rendering" (service 0.2.2), which the client's 'target' event leaves out
        let rendering = '';
        const handle = cr._event;
        if (typeof handle === 'function') {
            cr._event = function (ev) {
                try { if (ev && ev.ev === 'target' && ev.target === TARGET) rendering = typeof ev.rendering === 'string' ? ev.rendering : ''; } catch (e) { /* older service */ }
                return handle.apply(this, arguments);
            };
        }
        cr.on('target', (name, state, holder, reason) => {
            if (this.cr !== cr || name !== TARGET) return;
            const was = this.target.state;
            this.target = { state: state || '', holder: holder || '', reason: reason || '', rendering };
            rendering = '';
            // the slot lost under a shown logo, not to the stock map (a lock): let the HMI ask first
            if (was === 'shown' && this.visible && !holder && (state === 'waiting' || state === 'unavailable' || state === 'acquiring')) {
                this.yieldUntil = this.now() + YIELD_MS;
                this.log.info('cluster logo: slot lost (' + state + ') - asking again in ' + (YIELD_MS / 1000) + ' s');
                this._apply();
            }
            if (state !== was) this.log.info('cluster logo: map ' + state + (holder ? ' behind ' + holder : '') + (reason ? ' (' + reason + ')' : ''));
        });
        cr.on('refused', (op, ref, reason) => {
            if (this.cr !== cr) return;
            this.refused = (op || '?') + ': ' + (reason || '?'); this.log.warn('cluster logo: refused ' + this.refused);
            if (ref && ref === this.ref && this.kind === 'fx') this._fxFailed('refused (' + (reason || '?') + ')');
        });
        cr.on('status', (text) => {
            if (this.cr !== cr) return;
            this.answered++;
            const now = this.now(), seen = {}, others = [], under = [], idle = [];
            mapLayers(text, this.app).forEach((l) => {
                (drawing(l, this.seen, now) ? (this._covers(l) ? under : others) : idle).push(l);
                seen[l.app + '#' + l.id] = this.seen[l.app + '#' + l.id];
            });
            this.under = under;
            this.seen = seen;                                   // layers that went are forgotten
            if (others.length) { this.busyAt = now; this.lastBusy = others[0].app; }
            const was = this.others.map((l) => l.app).join(','), is = others.map((l) => l.app).join(',');
            if (was !== is) this.log.info('cluster logo: map ' + (is ? 'in use by ' + is : 'free of other apps') +
                (idle.length ? ' (idle: ' + idle.map((l) => l.app + ' ' + l.state).join(', ') + ')' : ''));
            this.others = others; this.idle = idle;
            this._own(ownLayers(text, this.app), now);
            this.polled = true;
            this._apply();
        });
        this.downAt = this.now();
        this.poll = this.T.setInterval(() => this._tick(), POLL_MS);
        try { cr.connect(); } catch (e) { this.log.warn('cluster logo: connect ' + e.message); }
    }
    _ask() { if (this.cr && this.ready) { this.stats.polls++; this.asked++; try { this.cr.status(); } catch (e) { /* next poll */ } } }

    /**
     * The car's route guidance (main.js's signal handlers): src 'nav' (NavigationStatus.guidingState),
     * 'carplay' or 'aa' (projectedGuidanceActive); v: the raw value (guideValue()).
     */
    guidance(src, v) {
        if (!Object.prototype.hasOwnProperty.call(this.guide, src)) return;
        const g = guideValue(src, v);
        this.rawText[src] = rawText(src, v, g);
        if (this.link[src] !== 'error') this.link[src] = 'up';
        this._route();
        if (g === null) { this.log.info('cluster logo: ' + src + ' guidance value not understood: ' + JSON.stringify(v)); return; }
        if (this.guide[src] !== g) this.log.info('cluster logo: ' + src + ' guidance ' + (g ? 'active' : 'off'));
        this.guide[src] = g;
        this._apply();
    }
    /**
     * A guidance signal's watch (main.js): state 'error' (no config / refused: n/a), 'down' (subscribed,
     * its provider not there: no answer) or 'up' (its provider there).
     */
    guideLink(src, state, why) {
        if (!Object.prototype.hasOwnProperty.call(this.link, src)) return;
        const st = state === 'error' || state === 'down' || state === 'up' ? state : '';
        if (st === this.link[src]) return;
        this.link[src] = st;
        if (st === 'error') this.log.info('cluster logo: ' + src + ' guidance signal n/a' + (why ? ' (' + why + ')' : ''));
        this._route();
    }
    /** Whether any guidance signal has given a value the logo understands. */
    routeKnown() { return this.guide.nav !== null || this.guide.carplay !== null || this.guide.aa !== null; }
    /** "Route: nav n/a · CarPlay off · AA no answer": each signal's link or its last value. */
    routeLine() {
        const one = (src) => this.rawText[src] || ({ error: 'n/a', down: 'no answer', up: 'no value' })[this.link[src]] || '--';
        return 'Route: nav ' + one('nav') + ' \u00b7 CarPlay ' + one('carplay') + ' \u00b7 AA ' + one('aa');
    }
    _route() {
        const line = this.routeLine();
        if (line !== this.lastRoute) { this.lastRoute = line; this.log.info('cluster logo: ' + line); }
    }
    /** A drawing layer the logo covers: every app's but G's TV's (Waze's map never hides it). */
    _covers(l) { return l.app !== 'ng_tv'; }
    /** The guidance, debounced: on for GUIDE_ON_MS -> guiding, off for GUIDE_OFF_MS -> not. */
    _guideTick(now) {
        const raw = (this.guide.nav === true || this.guide.carplay === true || this.guide.aa === true);
        if (raw !== this.rawGuide) { this.rawGuide = raw; this.rawSince = now; }
        const was = this.guiding;
        if (raw && !this.guiding && now - this.rawSince >= GUIDE_ON_MS) this.guiding = true;
        if (!raw && this.guiding && now - this.rawSince >= GUIDE_OFF_MS) this.guiding = false;
        if (was !== this.guiding) this.log.info('cluster logo: ' + (this.guiding ? 'route guidance active - logo hidden' : 'route guidance ended - logo back'));
        return this.guiding;
    }

    /** Every POLL_MS while open: the connection kept up, the status asked for, our layer kept. */
    _tick() {
        if (!this.want || !this.cr) return;
        const now = this.now();
        if (!this.ready) {
            if (now - this.downAt >= RECONNECT_MS) this._restart('not connected for ' + Math.round((now - this.downAt) / 1000) + ' s');
            return;
        }
        this._ask();
        // our layer in error (the service refused or failed it): made again, a few times per opening
        if (this.ref && this.layerState === 'error' && this.errRetries < ERR_RETRIES && now - this.errAt2 >= ERR_RETRY_MS) {
            this.errRetries++;
            this.log.info('cluster logo: layer in error - making it again (' + this.errRetries + ' of ' + ERR_RETRIES + ')');
            this._remake();
        }
    }
    /** A new connection (the old one dropped and closed), keeping what this run learnt. */
    _restart(why) {
        this.log.info('cluster logo: reconnecting (' + why + ')');
        this.stats.reconnects++;
        const cr = this.cr;
        if (this.poll) this.T.clearInterval(this.poll);
        if (this.anim) this.T.clearInterval(this.anim);
        try { if (this.ref) cr.drop(this.ref); } catch (e) { /* closing anyway */ }
        try { cr.close(); } catch (e) { /* gone */ }
        this._reset();
        this._connect();
    }
    /** Our layer as the service lists it: missing (once listed) for two polls -> made again. */
    _own(mine, now) {
        if (!this.ref) { this.ownMissing = 0; return; }
        if (mine.length) {
            this.ownSeen = true; this.ownMissing = 0;
            if (mine.some((l) => l.state === 'error') && this.layerState !== 'error') { this.layerState = 'error'; this.errAt2 = now; }
            return;
        }
        if (!this.ownSeen || now - this.madeAt < REMAKE_MS) return;
        if (++this.ownMissing < 2) return;
        this.log.warn('cluster logo: our layer is gone from the renderer - making it again');
        this._remake();
    }
    _remake() {
        const old = this.ref, w = this.key ? { kind: this.kind, look: this.key.split(':')[1] || '', key: this.key } : this._wanted();
        if (old) { try { this.cr.drop(old); this.stats.drops++; } catch (e) { /* gone already */ } }
        this.ref = 0; this.key = ''; this.kind = ''; this.ownSeen = false; this.ownMissing = 0;
        this.stats.remakes++;
        // the same layer again: an effect at once; a picture after the dropped one is freed (_apply's gate)
        if (w.kind === 'fx') this._make(w, !!this.visible); else { this._ask(); this.gate.dropped(this.asked); this._apply(); }
    }
    /** 0.13.1: the look's shader ruled out (this run): its baked picture, else the regular logo, instead */
    _fxFailed(why) {
        const look = this.key.split(':')[1] || '';
        if (!look || this.fxBad[look]) return;
        this.fxBad[look] = true;
        this.log.warn('cluster logo: ' + look + ' shader logo ' + why + ' - its picture instead');
        const old = this.ref;
        if (old) { try { this.cr.drop(old); this.stats.drops++; } catch (e) { /* gone */ } }
        this.ref = 0; this.key = ''; this.kind = ''; this.layerState = '';
        this._apply();
    }
    /** 0.13.1: the layer the look wants: { kind 'fx' | 'baked' | 'regular' | 'pixel', look, key } */
    _wanted() {
        // TNM fork: the owner's logo first, whatever the look; if it is missing or unusable, upstream's choice
        if (!this.bakedBad[CUSTOM] && this.images && typeof this.images.baked === 'function') return { kind: 'baked', look: CUSTOM, key: 'baked:' + CUSTOM };
        const look = this.look, k = this.pixel ? 'pixel' : CORE.kindOf(look);
        if (k === 'pixel') return { kind: 'pixel', look: 'pixel', key: 'pixel' };
        if (k === 'fx') {
            const fxOk = !this.fxBad[look] && this.cr && typeof this.cr.effect === 'function';
            if (fxOk) return { kind: 'fx', look, key: 'fx:' + look };
            if (!this.bakedBad[look] && this.images && typeof this.images.baked === 'function') return { kind: 'baked', look, key: 'baked:' + look };
        }
        return { kind: 'regular', look: '', key: 'regular' };
    }

    /** Shown or not, the image for the look, the parked animation. */
    _apply() {
        if (!this.want || !this.cr || !this.ready || !this.polled) return;
        const now = this.now();
        const guiding = this._guideTick(now);
        const vis = !guiding && !this.others.length && now - this.busyAt >= HOLD_MS && now >= this.yieldUntil;
        const w = this._wanted();
        const lk = this.pixel ? 'pixel' : this.look;      // the look picked (a fallback for the same look does not wait)
        if (lk !== this.wantKey) { this.wantKey = lk; this.lookAt = now; }
        if (this.ref && this.key !== w.key) {
            // a look change, once settled (SETTLE_MS): to or from an effect the new layer comes first (_make
            // drops the old after); picture to picture the old goes first and the new waits for the gate
            if (now - this.lookAt < MEM.SETTLE_MS) { this._animate(); return; }
            if (w.kind !== 'fx' && this.kind !== 'fx') {
                if (this.anim) { this.T.clearInterval(this.anim); this.anim = null; }
                try { this.cr.drop(this.ref); this.stats.drops++; } catch (e) { /* gone */ }
                this.log.info('cluster logo: ' + this.key + ' dropped first - ' + w.key + ' once it is freed');
                this.ref = 0; this.key = ''; this.kind = ''; this.layerState = '';
                this._ask(); this.gate.dropped(this.asked);
                return;
            }
            this._make(w, vis);
        } else if (!this.ref) {
            if (!vis) return;                              // nothing made until it may show
            if (!this.gate.open(this.answered)) return;    // a dropped picture not freed yet
            this._make(w, vis);
        } else if (vis !== this.visible) {
            this.visible = vis;
            this.cr.set(this.ref, { visible: vis });
            if (!vis) this.layerState = 'hidden';
            this.log.info('cluster logo: ' + (vis ? 'shown again' : guiding ? 'hidden (route guidance)' : 'hidden (map in use)'));
        }
        this._animate();
    }

    _make(w, vis) {
        if (w.kind === 'fx') return this._makeFx(w, vis);
        const kind = w.kind;
        let img = null;
        if (kind === 'baked') {
            try { img = this.images.baked(w.look); } catch (e) { img = null; }
            if (img && !img.d && img.data) img = { w: img.w, h: img.h, d: img.data };   // kit/png's decode: { w, h, data }
            const ew = w.look === CUSTOM ? CUSTOM_W : LOGO_W, eh = w.look === CUSTOM ? CUSTOM_H : LOGO_H;   // TNM fork
            if (!img || img.w !== ew || img.h !== eh || !img.d || img.d.length !== ew * eh * 4) {
                this.bakedBad[w.look] = true;
                this.log.warn('cluster logo: ' + CORE.PNG_OF(w.look) + ' not usable - the regular logo instead');
                return this._make({ kind: 'regular', look: '', key: 'regular' }, vis);
            }
        } else img = kind === 'pixel' ? this.images.pixel({}) : this.images.regular();
        const at = placement(kind, img);
        const ref = this.cr.image({ target: TARGET, klass: NAV_KLASS, z: NAV_Z, exclusive: false, contend: true,
            visible: vis, x: at.x, y: at.y, w: at.w, h: at.h, iw: img.w, ih: img.h,
            sampling: kind === 'pixel' ? 'nearest' : 'bilinear', fps: kind === 'pixel' ? FPS_ANIM : FPS_STILL });
        if (!ref) { this.log.warn('cluster logo: image layer refused by the client'); return; }
        this._send(ref, img);
        const old = this.ref;
        this.ref = ref; this.kind = kind; this.key = w.key; this.visible = vis; this.frameKey = 'still'; this.animAt = this.now(); this.madeAt = this.now();
        this.ownSeen = false; this.ownMissing = 0; this.contend = true;
        this.layerState = vis ? 'new' : 'hidden';
        this.stats.layers++;
        if (old) { this.cr.drop(old); this.stats.drops++; }
        this.log.info('cluster logo: ' + w.key + ' image ' + img.w + 'x' + img.h + ' (' + Math.round(img.d.length / 1024) + ' KB, once) at ' + at.x + ',' + at.y + ' ' + at.w + 'x' + at.h + ', ' + NAV_KLASS + ' z ' + NAV_Z + ', contending' + (vis ? '' : ', hidden'));
    }
    /** 0.13.1: the look's G as one still effect layer: 0 bytes of pixel budget, nothing sent after */
    _makeFx(w, vis) {
        const at = { x: Math.round((MAP_W - LOGO_W) / 2), y: Math.round((MAP_H - LOGO_H) / 2), w: LOGO_W, h: LOGO_H };
        let ref = 0;
        try {
            ref = this.cr.effect({ target: TARGET, klass: NAV_KLASS, z: NAV_Z, exclusive: false, contend: true,
                visible: vis, x: at.x, y: at.y, w: at.w, h: at.h, fs: CORE.fragment(w.look) });
        } catch (e) { ref = 0; }
        if (!ref) { this.fxBad[w.look] = true; this.log.warn('cluster logo: ' + w.look + ' shader logo refused by the client - its picture instead'); return this._apply(); }
        if (this.anim) { this.T.clearInterval(this.anim); this.anim = null; }
        const old = this.ref;
        this.ref = ref; this.kind = 'fx'; this.key = w.key; this.visible = vis; this.frameKey = 'still'; this.madeAt = this.now();
        this.ownSeen = false; this.ownMissing = 0; this.contend = true;
        this.layerState = vis ? 'new' : 'hidden';
        this.stats.layers++;
        if (old) { this.cr.drop(old); this.stats.drops++; }
        this.log.info('cluster logo: ' + w.look + ' shader logo (effect, still, 0 KB) at ' + at.x + ',' + at.y + ' ' + at.w + 'x' + at.h + ', ' + NAV_KLASS + ' z ' + NAV_Z + ', contending' + (vis ? '' : ', hidden'));
    }
    _send(ref, img) {
        if (this.cr.pixels(ref, null, img.d) !== false) { this.stats.sends++; this.stats.bytes += img.d.length; }
    }

    /** The Pixel emblem's slide-in and shine: only while parked and shown, else one still image. */
    _animate() {
        const run = this.kind === 'pixel' && this.parked && this.visible && this.want;
        if (!run) {
            if (this.anim) { this.T.clearInterval(this.anim); this.anim = null; }
            if (this.ref && this.kind === 'pixel' && this.frameKey !== 'still') { this._send(this.ref, this.images.pixel({})); this.frameKey = 'still'; }
            return;
        }
        if (!this.anim) { this.animAt = this.now(); this.anim = this.T.setInterval(() => this._frame(), ANIM_MS); }
    }
    _frame() {
        if (!(this.kind === 'pixel' && this.parked && this.visible && this.want && this.cr)) { this._animate(); return; }
        const o = motion(this.now() - this.animAt, this.o.emblemW || 27);
        const key = o ? o.key : 'still';
        if (key === this.frameKey) return;
        this.frameKey = key;
        this._send(this.ref, this.images.pixel(o ? o.opts : {}));
    }

    _off() {
        const cr = this.cr;
        if (this.poll) this.T.clearInterval(this.poll);
        if (this.anim) this.T.clearInterval(this.anim);
        if (cr) {
            try { if (this.ref) { cr.drop(this.ref); this.stats.drops++; } } catch (e) { /* closing anyway */ }
            try { cr.close(); } catch (e) { /* gone */ }
            this.log.info('cluster logo: off');
        }
        this._reset();
    }
    close() { this._off(); this.want = false; }
    /**
     * Options > Refresh cluster (0.8.0, a black bar left in the cluster): our layer dropped, the
     * connection closed and made again, the logo made anew (contending: it takes the map slot back
     * from the stock map). false: the logo is not up (off, closed, no renderer).
     */
    refresh() {
        if (!this.want || !this.cr) return false;
        this._restart('refresh');
        return true;
    }

    /** The Options line, short enough for its row: { kind: 'on' | 'wait' | 'off' | 'none' | 'error', text }. */
    view() {
        if (!this.enabled) return { kind: 'off', text: /^Off - /.test(this.idleText || '') ? this.idleText : 'Off' };   // 0.8.3: "Off - Map picked"
        if (this.err) return { kind: 'none', text: SHORT_ERR[this.err.error] || this.err.text };
        if (!this.want) return { kind: 'off', text: this.idleText || 'On - while G\'s Dash is open' };
        if (!this.cr || !this.ready || !this.polled) return { kind: 'wait', text: 'Connecting to renderer' };
        if (this.layerState === 'error') return { kind: 'error', text: 'Renderer refused the logo' };
        if (this.guiding) {
            return { kind: 'off', text: this.rawGuide ? 'Hidden - route guidance active' : 'Route ended - logo soon' };
        }
        if (this.rawGuide) return { kind: 'wait', text: 'Route guidance - hiding' };
        if (this.others.length) {
            const n = appName(this.others[0].app);
            return { kind: 'wait', text: n === 'Waze' ? 'Waiting - Waze map is up' : 'Waiting - ' + n + ' is drawing' };
        }
        if (!this.visible) {
            const stopped = this.lastBusy && this.now() - this.busyAt < HOLD_MS;
            return { kind: 'wait', text: (stopped ? appName(this.lastBusy) + ' stopped - logo soon' : 'Logo in a moment') };
        }
        const T = this.target;
        if ((T.state === 'parked' || T.state === 'waiting') && T.holder === 'stock') return { kind: 'wait', text: 'Taking over the stock map' };
        if (T.state === 'parked' || T.state === 'waiting') return { kind: 'wait', text: 'Map area taken - waiting' };
        if (T.state === 'shown') return { kind: 'on', text: this.routeKnown() ? 'Shown - not navigating' : 'Shown - route detection unavailable' };
        if (T.state === 'unavailable') return { kind: 'error', text: 'Map area unavailable' };
        return { kind: 'wait', text: 'Asking for the map area' };
    }
}
const SHORT_ERR = { missing: 'Needs Cluster renderer', noclient: 'Update Cluster renderer', untrusted: 'Renderer not trusted', load: 'Renderer failed to load' };

/**
 * The parked emblem's motion at t ms after it started: the stripes slide in (INTRO_MS), then a shine
 * of SHINE_MS every SHINE_EVERY; null between (the still image). key: the frame's identity.
 */
function motion(t, ew) {
    if (t < INTRO_MS) {
        const k = t / 700;
        const slide = [0, 1, 2].map((i) => Math.max(0, Math.min(1, k * 1.6 - i * 0.3))).map((x) => 1 - Math.pow(1 - x, 3));
        const q = slide.map((s) => Math.round(s * 20) / 20);
        if (q[0] >= 1 && q[1] >= 1 && q[2] >= 1) return null;
        return { key: 's' + q.join(','), opts: { slide: q } };
    }
    const c = (t - INTRO_MS) % SHINE_EVERY;
    if (c >= SHINE_MS) return null;
    const shine = Math.round(-4 + (c / SHINE_MS) * (ew + 6));
    return { key: 'h' + shine, opts: { shine } };
}

module.exports = { ClusterLogo, loadClient, trusted, mapLayers, ownLayers, drawing, guideValue, appName, pixelImage, regularImage, placement, motion, cellRaster,
    FX_BAD, rawText, TARGET, MAP_W, MAP_H, CELL, LOGO_W, LOGO_H, FPS_STILL, FPS_ANIM, POLL_MS, HOLD_MS, YIELD_MS, FRESH_MS, RECONNECT_MS, ERR_RETRY_MS, NAV_KLASS, NAV_Z, GUIDE_ON_MS, GUIDE_OFF_MS };
