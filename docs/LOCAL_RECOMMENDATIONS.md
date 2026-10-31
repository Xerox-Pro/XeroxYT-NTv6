# Local recommendation learning

Recommendation inference runs on the device, with no external generative AI call. YouTube search and metadata APIs still provide candidates. Ranking JSON is fetched directly by the browser. The legacy Gemini query-generation branch of `/api/recommendations` is removed.

## Signals and scope

Each account has two local profiles (normal and Shorts), each retaining up to 500 bounded signal rows. Normal searches and viewing interests also inform Shorts at a 0.65 weight; Shorts never train the normal profile. Passive watch signals decay with a 7-day half-life; explicit signals retain the 21-day half-life. Legacy rows infer their event kind from the existing key. No cross-user data, embeddings downloaded from a service, audio recognition or collaborative filtering is used.

Likes (+3), saves (+4), dislikes (-4), searches (+2), and opening Shorts comments (+0.3) contribute bounded signals. Removing a like/save offsets it. Repeated callbacks for one video/event replace its row rather than accumulating indefinitely. Search text that is a URL is ignored. Only actual save/remove actions train save feedback.

Playback learning uses actual playback-position deltas while playing and the document is visible. Pauses, buffering, inactive preloads, large seeks and long gaps contribute no viewing time. With no reliable embed progress messages, no watch-time or skip signal is invented. Each viewing session commits once when it ends. Closing the page, playback errors and retries do not count as a negative swipe. Not interested removes the clip from recommendation candidates and records explicit negative feedback. Quick swipes also provide weak automatic feedback. Merely showing a thumbnail or preloading an embed does not mark a video watched. Completion gives up to +1.4, replay contributes at most +0.4, and an actual sub-3-second swipe with less than 35% viewed contributes -0.8. Playback evidence is capped per video. Account switches discard in-flight evidence from the prior account.

## Candidate acquisition and ranking

Normal homepage candidate acquisition uses at most four rotating history IDs and three searches, including a locally learned topic. Public normalized pools share a bounded 15-minute warm-instance cache and concurrent identical work shares a promise. YouTube-authenticated home feeds remain private and separate. Shorts rotate two of up to five saved hashtags per page, plus a learned/search topic. Public parser results share bounded 5-minute warm-instance caches and extracted Shorts are memoized per parser object.

Ranking and discovery candidates are combined before local ranking, removing the fixed source ratio and truncation to the smaller source. Candidates are deduplicated, unseen clips come first, and matching local topics/channels contribute scores. Every fifth Shorts selection explores alternatives. Repeated topics and creators among the previous eight picks are penalized, and consecutive clips from one channel are avoided where alternatives exist. Explicitly rejected clips are filtered out. Generic #shorts/#youtube tokens do not train topic preference.

The combined Shorts queue adapts beyond the already visited prefix and two preloaded embeds when candidates or the active clip change. Existing positions and prepared embeds remain stable. Sparse or failed sources use available candidates.

Search Shorts stay restricted to the search query. Channel Shorts retain newest-to-oldest posting order and do not undergo personalized queue reordering. Native embedded controls remain intact.

## Validation and limits

Unit tests cover signal isolation, positive/negative ranking, duplicate callbacks, playback progress versus pause/seek/background time, replay caps and account switches. DOM tests cover navigation, native embeds, preload behavior and channel boundaries. Actual progress events and automatic playback depend on the embedded provider/browser; authenticated end-to-end playback was not verified in this environment.

Concept reference: https://newsroom.tiktok.com/how-tiktok-recommends-videos-for-you
The implementation is an independent local content-based scoring model, not TikTok's model or weights.

Cost architecture and release order: [COST_AND_SHORTS_DESIGN.md](COST_AND_SHORTS_DESIGN.md).
