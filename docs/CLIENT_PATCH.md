# CLIENT_PATCH.md

Where the Zellous client draws a server and chooses its name, and the exact change that makes it show the Discord guild logo and prefer the newest name event. The zellous app and wireweave are read-only references for this repository, so this is a proposal to route, not an edit. Written against the live Pages artifact: wireweave pin 115f7da3034a79662887fc4a45d3c3b1224bb43a and AnEntrypoint/zellous origin/main fdc82fb.

## Where the code lives

| Concern | Repository | File and lines |
|---|---|---|
| Choosing the server name and colour from kind 34550 | AnEntrypoint/wireweave (main) | src/servers.js, `_handleEvent` (subscription at the `my-servers` and per-author subscriptions, lines 38 and 48) |
| Local rename | AnEntrypoint/wireweave | src/servers.js, `rename` |
| Drawing the server rail | AnEntrypoint/zellous (main) | docs/js/nostr-servers-ui.js, `serverManager.renderList`, lines 302 to 318 |
| Feeding `state.servers` from wireweave | AnEntrypoint/zellous | docs/js/bridge/servers.js line 8 |
| Pin that selects the wireweave build served to users | AnEntrypoint/zellous | docs/nostr-chat/index.html import map |
| Base `.server-icon` style | the anentrypoint-design SDK, not the zellous CSS | so the logo patch carries its own inline style |

## Why the stale name and missing logo happen

1. `_handleEvent` assigns `existing.name = name` for every kind 34550 event from every relay and never compares `created_at`. Whichever relay copy arrives last wins. A relay that keeps the old Discord Bridge event (nos.lol) can therefore overwrite the newer 247420 copy on every load. Executed against a copy of the module: arriving stale-last gives `Discord Bridge`, arriving fresh-last gives `247420`.
2. `_handleEvent` reads only the `name` and `color` tags. The `icon` tag the bridge publishes is dropped.
3. `renderList` draws a coloured square with the first letter of the name. There is no image path at all.

## Change 1: wireweave src/servers.js

```diff
--- a/src/servers.js
+++ b/src/servers.js
@@ -4,6 +4,12 @@
 import { dtag } from './dtag.js';
 
 const SERVER_KIND = 34550;
+
+function isOlderNameEvent(server, event) {
+  if (!server.nameAt) return false;
+  if (event.created_at !== server.nameAt) return event.created_at < server.nameAt;
+  return String(event.id) > String(server.nameEventId);
+}
 const ZERO_OWNER = '0'.repeat(64);
 const OWN_DTAG_NAMESPACES = ['channels', 'roles', 'settings', 'selfroles', 'discover'];
 const MEMBER_KINDS = [42, 7];
@@ -62,9 +68,13 @@
     if (this.deleted.has(serverId)) return;
     const name = nameTag ? nameTag[1] : serverId.slice(0, 8);
     const iconColor = colorTag && /^#[0-9a-fA-F]{6}$/.test(colorTag[1]) ? colorTag[1] : '#5865F2';
+    const iconTag = event.tags.find(t => t[0] === 'icon');
+    const icon = iconTag && /^https:\/\/[^\s"'<>]{1,500}$/.test(iconTag[1]) ? iconTag[1] : null;
     const existing = this.servers.find(s => s.id === serverId);
-    if (existing) { existing.name = name; existing.iconColor = iconColor; existing.ownerId = event.pubkey; this.servers = [...this.servers]; }
-    else this.servers = [...this.servers, { id: serverId, name, iconColor, ownerId: event.pubkey }];
+    if (existing && isOlderNameEvent(existing, event)) return;
+    const stamp = { nameAt: event.created_at, nameEventId: event.id };
+    if (existing) { Object.assign(existing, { name, iconColor, icon, ownerId: event.pubkey }, stamp); this.servers = [...this.servers]; }
+    else this.servers = [...this.servers, { id: serverId, name, iconColor, icon, ownerId: event.pubkey, ...stamp }];
     this._persist();
     this._emit('updated', { servers: this.servers });
   }
@@ -167,7 +177,7 @@
     const signed = await this.auth.sign({ kind: 34550, created_at: replaceableTs(), tags: [['d', dTag], ['name', name], ['color', iconColor]], content: '' });
     this.pool.publish(signed);
     const s = this.servers.find(x => x.id === serverId);
-    if (s) { s.name = name; s.iconColor = iconColor; this.servers = [...this.servers]; this._persist(); this._emit('updated', { servers: this.servers }); }
+    if (s) { Object.assign(s, { name, iconColor, nameAt: signed.created_at, nameEventId: signed.id }); this.servers = [...this.servers]; this._persist(); this._emit('updated', { servers: this.servers }); }
   }
 
   async create(name, iconColor = '#5865F2') {
```

The newest event wins regardless of arrival order. An equal `created_at` is broken by the lowest event id, as NIP-01 specifies for replaceable events, so two clients converge on one copy. Entries persisted before the change have no `nameAt`, so the first event after upgrade is accepted and stamps them. The icon must be an https URL of at most 500 characters without whitespace, quotes or angle brackets; anything else becomes null. `rename` also stamps the local entry. A follow-up in the same file: `rename` and `create` should include `['icon', server.icon]` when the server already has one, otherwise the next owner event drops the logo.

Executed trial on a copy of the pinned module, original against patched, both arrival orders: original `fresh then stale` shows Discord Bridge and `stale then fresh` shows 247420; patched shows 247420 with the icon in both orders, an equal timestamp resolves to the lowest id in both orders, and `javascript:` and quote-bearing icon values become null. Result `PATCH_TRIAL_PASS`.

## Change 2: zellous docs/js/nostr-servers-ui.js, `renderList`

```diff
-    html += '<div class="server-icon' + active + '" data-server-id="' + escHtml(s.id) + '" style="background:' + escHtml(bg) + '" title="' + escHtml(s.name || '') + '" tabindex="0" role="button" aria-label="' + escHtml(s.name || 'Server') + '">' +
-              '<div class="server-pill"></div>' + escHtml(initial) +
-            '</div>';
+    var logo = /^https:\/\//.test(s.icon || '') ? '<img src="' + escHtml(s.icon) + '" alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit">' : '';
+    html += '<div class="server-icon' + active + '" data-server-id="' + escHtml(s.id) + '" style="background:' + escHtml(bg) + ';position:relative" title="' + escHtml(s.name || '') + '" tabindex="0" role="button" aria-label="' + escHtml(s.name || 'Server') + '">' +
+              '<div class="server-pill"></div>' + escHtml(initial) + logo +
+            '</div>';
```

The first letter stays underneath, so a failed image load degrades to today's rail. The page sets no Content-Security-Policy, so the Discord CDN image loads. This change has not been executed here; it needs a browser check on the live page after the pin bump.

## Does it fit a small patch

Yes. About twelve changed lines in wireweave plus a test, and four in zellous. Order of work: patch and test wireweave on main, take the new commit sha, bump the wireweave import map pin in zellous docs/nostr-chat/index.html together with Change 2, publish Pages. After the new pin goes live, this bridge follows the pin through its normal live-alignment step; the seven-file protocol set does not change because only servers.js moves. Until clients load the new pin the stale nos.lol copy can still win; relay:heal remains the interim mitigation, and the logo stays in the owner bundle and Discover listing.

## Not claimed

The rail logo is not shown today and this bridge cannot make it show. No live client was changed.
