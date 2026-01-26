/**
 * # Test Mocks
 *
 * Comprehensive test fixtures for SWGoHBot testing.
 * Provides realistic, stateful mocks for Bot and Interaction objects.
 *
 * 📖 **[Full Documentation](./README.md)** | 🚀 **[Quick Reference](./QUICK_REFERENCE.md)** | ✅ **[Examples](./verification.test.ts)**
 *
 * ## Features
 *
 * ### mockBot
 * - **Comprehensive data**: 15 characters, 8 ships, factions, missions, resources
 * - **Stateful cache**: In-memory storage that actually filters and retrieves data
 * - **Full swgohAPI**: units(), getPlayer(), getGuild(), unitSearch()
 * - **Module functions**: eventFuncs, patreonFuncs with method stubs
 * - **Deep merge**: Override any property with recursive merging
 *
 * ### mockInteraction
 * - **Discord properties**: user, guild, member, client with realistic defaults
 * - **State tracking**: Monitors deferred/replied state
 * - **Reply tracking**: _getReplies() helper for test assertions
 * - **Full options API**: getString, getInteger, getBoolean, getSubcommand, etc.
 * - **Enhanced language**: Supports named placeholders and object returns
 * - **Options data**: Configure command options via optionsData parameter
 *
 * ## Usage Examples
 *
 * ### Basic Bot Mock
 * ```typescript
 * import { createMockBot } from "./test/mocks/index.ts";
 *
 * const bot = createMockBot();
 * const units = await bot.swgohAPI.units("eng_us");
 * // Returns 23 units (15 characters + 8 ships)
 * ```
 *
 * ### Bot with Cache
 * ```typescript
 * const bot = createMockBot();
 *
 * // Store data
 * await bot.cache.put("testdb", "users", { id: "123" }, { name: "Test", score: 100 });
 *
 * // Retrieve data
 * const user = await bot.cache.getOne("testdb", "users", { id: "123" });
 * // Returns { id: "123", name: "Test", score: 100 }
 * ```
 *
 * ### Override Bot Properties
 * ```typescript
 * const bot = createMockBot({
 *   shardId: 5,
 *   config: {
 *     mongodb: { swgohbotdb: "customdb" }
 *   }
 * });
 * ```
 *
 * ### Basic Interaction Mock
 * ```typescript
 * import { createMockInteraction } from "./test/mocks/index.ts";
 *
 * const interaction = createMockInteraction();
 * await interaction.reply("Test response");
 * const replies = (interaction as any)._getReplies();
 * // Returns ["Test response"]
 * ```
 *
 * ### Interaction with Command Options
 * ```typescript
 * const interaction = createMockInteraction({
 *   optionsData: {
 *     character: "vader",
 *     limit: 10,
 *     verbose: true
 *   }
 * });
 *
 * interaction.options.getString("character"); // Returns "vader"
 * interaction.options.getInteger("limit");    // Returns 10
 * interaction.options.getBoolean("verbose");  // Returns true
 * ```
 *
 * ### Test State Tracking
 * ```typescript
 * const interaction = createMockInteraction();
 *
 * console.log(interaction.deferred); // false
 * console.log(interaction.replied);  // false
 *
 * await interaction.deferReply();
 * console.log(interaction.deferred); // true
 *
 * await interaction.reply("Done!");
 * console.log(interaction.replied);  // true
 * ```
 *
 * ## Migration from Local Mocks
 *
 * If your test files currently create their own mocks, migrate to these shared mocks:
 *
 * ### Before
 * ```typescript
 * // In your test file
 * const mockBot = {
 *   cache: { get: async () => [] },
 *   swgohAPI: { getCharacter: async () => ({}) }
 * } as any;
 * ```
 *
 * ### After
 * ```typescript
 * import { createMockBot } from "../mocks/index.ts";
 *
 * const bot = createMockBot();
 * // Fully functional cache and swgohAPI included
 * ```
 *
 * ### Custom Overrides
 * ```typescript
 * // If you need specific behavior
 * const bot = createMockBot({
 *   cache: {
 *     get: async () => [{ custom: "data" }]
 *   }
 * });
 * ```
 *
 * ## Testing Best Practices
 *
 * 1. **Use shared mocks by default** - Reduces duplication and maintenance
 * 2. **Override only what you need** - Deep merge preserves other defaults
 * 3. **Test cache behavior** - Use put/get to verify data persistence
 * 4. **Check interaction state** - Use deferred/replied to verify flow
 * 5. **Inspect replies** - Use _getReplies() for assertions
 *
 * @module test/mocks
 */

export * from "./mockBot.ts";
export * from "./mockInteraction.ts";
