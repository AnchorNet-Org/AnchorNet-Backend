import { toCsv } from "./csv";

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
});
