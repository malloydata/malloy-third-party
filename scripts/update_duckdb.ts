/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import fetch from "node-fetch";
import tar from "tar-stream";

import duckdbPackage from "@malloydata/db-duckdb/package.json";

const DUCKDB_VERSION =
  process.argv.length > 2 ? process.argv[2] : duckdbPackage.dependencies.duckdb;

export const targetDuckDBMap: Record<string, string> = {
  "darwin-arm64": `duckdb-v${DUCKDB_VERSION}-node-v93-darwin-arm64.node`,
  "darwin-x64": `duckdb-v${DUCKDB_VERSION}-node-v93-darwin-x64.node`,
  "linux-x64": `duckdb-v${DUCKDB_VERSION}-node-v93-linux-x64.node`,
  "win32-x64": `duckdb-v${DUCKDB_VERSION}-node-v93-win32-x64.node`,
};

const fetchNode = async (target: string, file: string) => {
  const url = `https://duckdb-node.s3.amazonaws.com/duckdb-v${DUCKDB_VERSION}-node-v93-${target}.tar.gz`;
  const filePath = path.resolve(
    path.join("third_party", "github.com", "duckdb", "duckdb", file)
  );
  if (fs.existsSync(filePath)) {
    console.info(`Already exists: ${file}`);
    return;
  }
  console.info(`Fetching: ${url}`);
  const extract = tar.extract();
  const response = await fetch(url);
  await new Promise((resolve, reject) => {
    try {
      extract.on("entry", async (header, stream, next) => {
        const outFile = fs.openSync(filePath, "w", header.mode);

        for await (const chunk of stream) {
          fs.writeFileSync(outFile, chunk);
        }

        stream.on("end", () => {
          fs.closeSync(outFile);
          next();
        });
      });

      extract.on("finish", function () {
        resolve(null);
      });
      extract.on("error", function (error) {
        console.error(error);
        reject(error);
      });
    } catch (error) {
      console.error(error);
      reject(error);
    }
    if (response.ok) {
      const stream = response.body;
      if (stream) {
        console.info(`Reading: ${url}`);
        stream.pipe(zlib.createGunzip()).pipe(extract);
      }
    } else {
      console.error(`Failed to fetch ${file}: ${response.statusText}`);
    }
  });
};

(async () => {
  const fetches: Promise<void>[] = [];

  for (const [target, file] of Object.entries(targetDuckDBMap)) {
    fetches.push(fetchNode(target, file));
  }

  await Promise.allSettled(fetches);
})();
