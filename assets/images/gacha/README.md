# Generated gacha artwork

Built-in image generation was used; no CLI/API fallback. The source generation and alpha-extraction outputs are preserved outside the repository. These are project-owned copies, not remote image URLs.

## Assets

- `cozy-gift-parts-v1.webp`: 1024 × 1024 RGBA (generated at 1254 px, resized + WebP q86 — 1.3 MB → 99 KB), detached lid above the open base. Runtime clipping at normalized y=0.44 keeps both original layers intact; the lid translates vertically to close/open. The final PNG has a real alpha channel (verified with `sips`).
- `forest-stage-v1.webp`: 1024 × 1537 portrait watercolor forest stage (2.2 MB PNG → 120 KB), used as the full-screen reward background.

Reference: the user-provided Rougether gacha screen (cream gift boxes and sage/lavender ribbons). No user screenshot is shipped in the app.

## Generation prompt: gift parts

Use case: stylized-concept. Asset type: production-ready layered game sprite for the cozy Korean routine and room-decorating game Rougether. Input image 1 is a STYLE REFERENCE ONLY: match the hand-painted cream gift boxes, sage-green fabric ribbons, delicate honey-brown pencil outlines and watercolor paper texture of its game artwork; do not reproduce the UI. Generate ONE square 1024x1024 transparent PNG, an exploded-view illustration of ONE enchanting keepsake gift box, with its detached lid floating clearly above its open base. Warm ivory wooden-paper box with rounded corners, pale gold edging, a sage-green satin ribbon and a round tiny embossed paw medallion on the FRONT of the base; a lush sage bow on top of the lid. Slight elevated frontal view, symmetrical front, just enough visible top surface for depth, soft handmade storybook shading rather than glossy 3D. Critical animation layout: box BASE centered horizontally at x=512, occupies approximately x=210..814 and y=500..870; its opening is visible with soft golden cream lining. LID centered at the same x=512, matching the base width and perspective, occupies approximately x=190..834 and y=130..350 INCLUDING the bow. There MUST be a completely empty transparent horizontal strip y=380..460 across the full canvas: these two separated parts will be independently animated. Lid has the same orientation as if sitting on the box, not tilted away and not attached by hinges. Both parts fully visible, consistent scale, straight aligned matching edges; the lid would neatly close the base when translated straight down. Isolate ONLY these two parts on genuinely transparent alpha, NOT a white background and NOT a baked checkerboard. No sparkles, no glow outside object, no floor, no cast shadow, no environment, no text, no lettering, no labels, no frame, no watermark. This is final game art, not an asset sheet with panels.

## Follow-up: real alpha extraction

Use case: background-extraction. Edit target is this exploded-view gift-box sprite. Remove the gray-and-white checkerboard background COMPLETELY and deliver the two objects as a transparent PNG with a real alpha channel. The checkerboard in the supplied image is baked into the pixels; it is NOT transparency. Replace ALL background, including the full empty horizontal gap between lid and box and around the edges, with alpha=0. Keep the exact original image dimensions, object positions, scale, outlines, fine paper texture, sage ribbon, paw medallions, colors and every pixel of the illustrated box and lid unchanged. Do not add any checkerboard, any flat color, any new shadow, glow, text or other objects. Only remove the background.

## Generation prompt: forest stage

Use case: stylized-concept. Asset type: full-bleed mobile game reward-opening stage background, portrait 2:3. Create an inviting magical forest nook for a cozy Korean routine-tracking and room-decorating game. Match the warm cream, muted sage green, honey-gold pencil linework and fine watercolor-paper grain of the reference game UI's illustrated gift boxes, NOT the UI itself. A quiet storybook forest at blue-green dusk, rounded leafy canopy and ferns framing only the outer left and right edges, a few tiny honey-gold fireflies and four-point twinkles. The middle two-thirds must remain uncluttered, a soft desaturated sage atmospheric clearing with a very gentle warm ivory glow in its center. At the bottom quarter, a small oval honey-colored wooden platform/stump with a faint carved paw motif and soft moss, its entire top visible as the reward stage. Dreamy soft volumetric light from above; rich but muted forest depth, cozy and celebratory, tactile hand-painted illustration, rounded friendly shapes. Keep the platform around y=78%, allow generous empty breathing room above it so a separate animated gift box and reward cards can be composited. No box, no treasure chest, no gift, no characters, no animals, no mushrooms in the center, no letters, no text, no UI controls, no panels, no border, no logo, no watermark. This is a production game background, not a screenshot or mockup.

## Runtime and review

The UI uses native-driven layer transforms rather than a looping video: it can wait for the server response, accept a reveal tap, and respect reduced motion. Opening the gift does not call the draw API again. With reduced motion enabled the stage is skipped; only the already-awarded results are shown. An image decode error falls back to the selected machine art.

Preview at `/dev?entry=GachaScreen` (development only). The preview uses local result fixtures and does not spend real coins. Production draw costs, odds and reward contents remain server-controlled.
