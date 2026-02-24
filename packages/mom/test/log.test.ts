import { describe, it, expect } from "vitest";
import { formatContext, truncate, formatToolArgs, LogContext } from "../src/log.js";

describe("log formatting utilities", () => {
	describe("formatContext", () => {
		it("should format DM context with username", () => {
			const ctx: LogContext = {
				channelId: "D123",
				userName: "jdoe",
			};
			expect(formatContext(ctx)).toBe("[DM:jdoe]");
		});

		it("should format DM context with channelId if username is missing", () => {
			const ctx: LogContext = {
				channelId: "D123",
			};
			expect(formatContext(ctx)).toBe("[DM:D123]");
		});

		it("should format channel context with channel name and username", () => {
			const ctx: LogContext = {
				channelId: "C123",
				channelName: "general",
				userName: "jdoe",
			};
			expect(formatContext(ctx)).toBe("[#general:jdoe]");
		});

		it("should format channel context and add # if missing from channel name", () => {
			const ctx: LogContext = {
				channelId: "C123",
				channelName: "dev-team",
				userName: "jdoe",
			};
			expect(formatContext(ctx)).toBe("[#dev-team:jdoe]");
		});

		it("should format channel context and not double # if already present", () => {
			const ctx: LogContext = {
				channelId: "C123",
				channelName: "#dev-team",
				userName: "jdoe",
			};
			expect(formatContext(ctx)).toBe("[#dev-team:jdoe]");
		});

		it("should format channel context with channelId if channel name is missing", () => {
			const ctx: LogContext = {
				channelId: "C123",
				userName: "jdoe",
			};
			expect(formatContext(ctx)).toBe("[#C123:jdoe]");
		});

		it("should format channel context with 'unknown' if username is missing", () => {
			const ctx: LogContext = {
				channelId: "C123",
				channelName: "general",
			};
			expect(formatContext(ctx)).toBe("[#general:unknown]");
		});
	});

	describe("truncate", () => {
		it("should not truncate if text is within limit", () => {
			const text = "short text";
			expect(truncate(text, 20)).toBe(text);
		});

		it("should truncate if text exceeds limit", () => {
			const text = "this is a very long text that should be truncated";
			const limit = 10;
			const expected = "this is a \n(truncated at 10 chars)";
			expect(truncate(text, limit)).toBe(expected);
		});

		it("should handle text exactly at limit", () => {
			const text = "1234567890";
			expect(truncate(text, 10)).toBe(text);
		});
	});

	describe("formatToolArgs", () => {
		it("should return empty string for empty args", () => {
			expect(formatToolArgs({})).toBe("");
		});

		it("should skip 'label' argument", () => {
			expect(formatToolArgs({ label: "some label", other: "value" })).toBe("value");
		});

		it("should format 'path' with 'offset' and 'limit'", () => {
			const args = {
				path: "/some/file.txt",
				offset: 100,
				limit: 50,
			};
			expect(formatToolArgs(args)).toBe("/some/file.txt:100-150");
		});

		it("should format 'path' without offset/limit if they are missing", () => {
			const args = {
				path: "/some/file.txt",
			};
			expect(formatToolArgs(args)).toBe("/some/file.txt");
		});

		it("should format multi-line strings", () => {
			const args = {
				code: "line 1\nline 2",
			};
			expect(formatToolArgs(args)).toBe("line 1\nline 2");
		});

		it("should JSON stringify non-string values", () => {
			const args = {
				count: 42,
				flag: true,
				obj: { key: "value" },
			};
			const result = formatToolArgs(args);
			expect(result).toContain("42");
			expect(result).toContain("true");
			expect(result).toContain('{"key":"value"}');
		});

		it("should join multiple arguments with newlines", () => {
			const args = {
				arg1: "val1",
				arg2: "val2",
			};
			expect(formatToolArgs(args)).toBe("val1\nval2");
		});
	});
});
