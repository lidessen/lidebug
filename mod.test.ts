import { xiaoxitian } from "./mod.ts";

await xiaoxitian({
  name: "test",
  launchOptions: {
    headless: false,
    devtools: true,
  },
  plugins: [
    async ({ addInitScript, mapLocal, mock, modifyJs, modifyJson, open }) => {
      await addInitScript("console.log('Hello, World!');");

      mapLocal("https://example.com/test", "./mod.ts");

      mock("https://example.com/test.js", {
        status: 200,
        contentType: "application/javascript",
        body: "console.log('Hello, World!');",
      });

      mock("https://example.com/test.json", {
        status: 200,
        contentType: "application/json",
        body: '{ "hello": "world" }',
      });

      modifyJs("https://example.com/test.js", (content) => {
        return content.replace(
          "console.log('Hello, World!');",
          "console.log('Hello, World! Modified');"
        );
      });

      modifyJson("https://example.com/test.json", (json) => {
        json.hello = "world modified";
        return json;
      });

      await open("https://example.com/test.json");
    },
  ],
});
