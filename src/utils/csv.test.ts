import { toCsv } from "./csv";

/** Parses one field emitted by the CSV serializer. */
function parseEscapedField(field: string): string {
  if (!field.startsWith('"')) {
    return field;
  }

  if (field.length < 2 || !field.endsWith('"')) {
    throw new Error("Unterminated quoted CSV field");
  }

  let parsed = "";
  for (let index = 1; index < field.length - 1; index += 1) {
    const character = field[index];
    if (character !== '"') {
      parsed += character;
      continue;
    }

    if (field[index + 1] !== '"') {
      throw new Error("Unexpected quote in CSV field");
    }

    parsed += '"';
    index += 1;
  }

  return parsed;
}

describe("toCsv", () => {
  it("renders a header row followed by one row per item", () => {
    const csv = toCsv(
      [
        { id: "a", name: "Anchor A" },
        { id: "b", name: "Anchor B" },
      ],
      ["id", "name"],
    );

    expect(csv).toBe("id,name\na,Anchor A\nb,Anchor B\n");
  });

  it("renders only the header for an empty array", () => {
    expect(toCsv([], ["id", "name"])).toBe("id,name\n");
  });

  it("quotes fields containing a comma", () => {
    const csv = toCsv([{ id: "a", name: "Smith, Jones" }], ["id", "name"]);
    expect(csv).toBe('id,name\na,"Smith, Jones"\n');
  });

  it("escapes embedded quotes by doubling them", () => {
    const csv = toCsv([{ id: "a", name: 'Say "hi"' }], ["id", "name"]);
    expect(csv).toBe('id,name\na,"Say ""hi"""\n');
  });

  it("quotes fields containing a newline", () => {
    const csv = toCsv([{ id: "a", name: "line1\nline2" }], ["id", "name"]);
    expect(csv).toBe('id,name\na,"line1\nline2"\n');
  });

  it("renders missing fields as an empty cell", () => {
    const csv = toCsv([{ id: "a" }], ["id", "name"]);
    expect(csv).toBe("id,name\na,\n");
  });

  describe("round-trip", () => {
    const cases: Array<[string, unknown, string]> = [
      ["plain ASCII", "Anchor Network", "Anchor Network"],
      ["embedded comma", "one,two", "one,two"],
      ["embedded quote", 'Say "hello"', 'Say "hello"'],
      ["adjacent quotes", 'before "" after', 'before "" after'],
      ["embedded newline", "line one\nline two", "line one\nline two"],
      ["embedded CRLF", "line one\r\nline two", "line one\r\nline two"],
      ["unicode", "Anchor 🌍 café 漢字", "Anchor 🌍 café 漢字"],
      [
        "comma, quote, and newline together",
        'first, "second"\nthird',
        'first, "second"\nthird',
      ],
      ["empty string", "", ""],
      ["undefined", undefined, ""],
      ["null", null, ""],
    ];

    test.each(cases)("preserves %s", (_description, value, expected) => {
      const csv = toCsv([{ value }], ["value"]);
      const serializedField = csv.slice("value\n".length, -1);

      expect(parseEscapedField(serializedField)).toBe(expected);
    });
  });
});
