/**
 * # Test Mocks
 *
 * Comprehensive test fixtures for SWGoHBot testing.
 * Provides realistic, stateful mocks for Interaction objects.
 *
 * 📖 **[Full Documentation](./README.md)** | 🚀 **[Quick Reference](./QUICK_REFERENCE.md)** | ✅ **[Examples](./verification.test.ts)**
 *
 * ## Features
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
 * ## Testing Best Practices
 *
 * 1. **Use shared mocks by default** - Reduces duplication and maintenance
 * 2. **Check interaction state** - Use deferred/replied to verify flow
 * 3. **Inspect replies** - Use _getReplies() for assertions
 *
 * @module test/mocks
 */

export * from "./mockInteraction.ts";
export * from "./mockSwapi.ts";
