import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import { chunk } from "lodash";
import urls from "../tx-urls.json";
import { sleep } from "./utils/sleep";

type Result = {
  url: string;
  duration: number;
};

function convertToSeconds(duration: string) {
  let totalSeconds = 0;

  // Split the duration string by spaces to handle multiple parts (e.g., "1min: 1s")
  const parts = duration.split(" ");

  parts.forEach((part) => {
    // If the part contains "min:", extract the minutes and seconds
    if (part.includes("min:")) {
      const [min, sec] = part.split("min:");
      totalSeconds += parseInt(min) * 60; // Convert minutes to seconds and add to total
      if (sec) {
        totalSeconds += parseInt(sec); // Add the remaining seconds to total
      }
    } else if (part.includes("s")) {
      // If the part is only seconds
      totalSeconds += parseInt(part);
    }
  });

  return totalSeconds;
}

async function crawler(url: string): Promise<Result | undefined> {
  const response = await axios.get(url);

  // Load the HTML content into Cheerio
  const $ = cheerio.load(response.data);

  // Use a selector to find the element containing the duration text
  const durationText = $('div:contains("Duration:")').text();

  // Use a regular expression to extract the duration
  const match = durationText.match(/Duration:\s*([\d\smin:]+s)/);

  // Check if a match was found and extract the duration
  if (match && match[1]) {
    const duration = convertToSeconds(match[1]);

    return {
      url,
      duration,
    };
  } else {
    console.log("Duration not found");
  }
}
const CHUCK_SIZE = 200;

(async () => {
  //   const urls = Array.from(
  //     { length: 3000 },
  //     () =>
  //       "https://testnet.tonviewer.com/transaction/8d72f92dcc8d7ed5980cd1fb8862d08e98800d8cd757d05e01932dd3acbf2056"
  //   );

  const chunks = chunk(urls, CHUCK_SIZE);
  const start = Date.now();
  console.log("Chucked", urls.length, "urls into", chunks.length, "chunks");

  const fulfilled: Result[] = [];

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map((url) => crawler(url).catch(console.error))
    );

    //   save result to result.json
    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        fulfilled.push(result.value);
      }
    });

    console.log("Crawled chunk", results.length, "urls");

    sleep(1000);
  }

  console.log(
    "Crawled",
    fulfilled.length,
    "/",
    urls.length,
    "urls in",
    (Date.now() - start) / 1000,
    "s"
  );
  fs.writeFileSync("result.json", JSON.stringify(fulfilled, null, 2));
})();
