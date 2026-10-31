# Local recommendation learning

Recommendation inference runs on the device, with no external generative AI call. YouTube search and metadata APIs still provide candidates. Ranking JSON is fetched directly by the browser. The legacy Gemini query-generation branch of `/api/recommendations` is removed.

## Signals and scope

Each account has two local profiles (normal and Shorts), each retaining up to 500 bounded signal rows. Normal searches and viewing interests also inform Shorts at a 0.65 weight; Shorts never train the normal profile. Topic and channel weights decay with a 21-day half-life. No cross-user data, embeddings downloaded from a service, audio recognition or collaborative filtering is used.

Likes (+3), saves (+4), dislikes (-4), searches (+2), and opening Shorts comments (+0.3) contribute bounded signals. Removing a like/save offsets it. Repeated callbacks for one video/event replace its row rather than accumulating indefinitely. Search text that is a URL is ignored. Only actual save/remove actions train save feedback.

Playback learning uses actual playback-position deltas while playing and the document is visible. Pauses, buffering, inactive preloads, large seeks and long gaps contribute no viewing time. With no reliable embed progress messages, no watch-time or skip signal is invented. Each viewing session commits once when it ends. Closing the page, playback errors and retries do not count as a negative swipe. There is no Not interested button; quick swipes provide weak automatic feedback. Completion gives up to +1.4, replay contributes at most +0.4, and an actual sub-3-second swipe with less than 35% viewed contributes -0.8. Playback evidence is capped per video. Account switches discard in-flight evidence from the prior account.

## Candidate acquisition and ranking

Normal homepage queries include up to five locally learned positive topics. Shorts continue collecting up to five normal-viewing hashtags with up to ten real clips per tag, plus a search/learned topic. The interest candidate target remains about 30% of the final mixed feed when enough candidates exist. Ranking and normal discovery sources still alternate. Ranking order is personalized with session randomness rather than view-count order.

Candidates are deduplicated, unshown clips come first, and matching local topics/channels contribute scores. Every fifth selection uses session variation to explore candidates. Consecutive clips from one channel are avoided where alternatives exist. Sparse or failed sources fall back to available candidates.

The Shorts queue adapts beyond the already visited prefix and two preloaded embeds when the active clip changes. Existing positions and ready embeds remain stable. Source mixing quotas are retained; this is not a single unconstrained global relevance ranking.

Search Shorts stay restricted to the search query. Channel Shorts retain newest-to-oldest posting order and do not undergo personalized queue reordering. Native embedded controls remain intact.

## Validation and limits

Unit tests cover signal isolation, positive/negative ranking, duplicate callbacks, playback progress versus pause/seek/background time, replay caps and account switches. DOM tests cover navigation, native embeds, preload behavior and channel boundaries. Actual progress events and automatic playback depend on the embedded provider/browser; authenticated end-to-end playback was not verified in this environment.

Concept reference: https://newsroom.tiktok.com/how-tiktok-recommends-videos-for-you
The implementation is an independent local content-based scoring model, not TikTok's model or weights.
