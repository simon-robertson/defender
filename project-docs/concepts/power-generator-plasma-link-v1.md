# Power-generator plasma link — approved concept

Approved on 18 October 2026. The user requested a wobbly green plasma connection, considered a procedural effect appropriate, and accepted this concept with “That looks good.” Connections from active power generators to their recipients are now implemented and verified.

![Approved green plasma-link concept, shown by day and night](power-generator-plasma-link-v1.png)

Created with the built-in image generator. [Saved generation prompt](power-generator-plasma-link-v1.prompt.txt). This is a visual concept, not a production screenshot.

Use one continuous, smooth green plasma tube per connection, with a gently irregular three-dimensional wobble, travelling bulges and a slim pale mint-white core. Keep both endpoints anchored to solid surfaces of the existing models. The concept joins the generator’s upper edge to the turret’s fixed lower shoulder/pedestal below its rotating head; runtime attachment helpers must use the actual approved geometry. Preserve silhouettes and the turret’s red identity accents.

Green light comes from the entire connection, illuminating nearby casing, armour and ground along its length. The controlled glow must leave models readable by day and night without tinting the whole scene green. No new models or receiver attachments, branching bolts, sparks, smoke, projectiles or extra effects are included.

The connection visualises the existing [base-generator enhancement](../power-generator-model.md); it does not apply damage or calculate bonuses. Engineer implemented the procedural effect and renderer, Artist supplied fixed-face attachment selection and accepted production day/night comparisons, and Lead integrated and verified the game and review tool. Initial verification passes 26 affected tests / 139,057 assertions and 44/44 GPU checks. [GPU evidence](../plasma-gpu-review.json), [day capture](../screenshots/power-link-day.jpg), [night capture](../screenshots/power-link-night.jpg), [night without link](../screenshots/power-link-night-off.jpg).

The user subsequently requested smaller waves and +100% motion speed. Current displacement is `min(0.6, length * 0.05)` and phase rate 6.4, halving/doubling the initial settings respectively. Width 0.8 and light strength/radius 1.8/14 remain unchanged. Five pool checks / 5,154 assertions passed again after this tuning; Lead reviewed it live and completed T/R/rain and A1→A2→A1 lifecycle checks without errors. [Latest capture](../screenshots/power-link-smaller-faster.jpg), [browser evidence](../plasma-browser-review.json), [implementation and bounded costs](../engine.md#generator-plasma-connections-18-october).
