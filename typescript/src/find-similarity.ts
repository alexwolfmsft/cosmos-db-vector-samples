/*

This file is used to identify data items with high similarity, which may impact the accuracy of vector-based comparisons.

*/

import { config } from './config.js';
import { readFileReturnJson, writeFileJson, JsonData } from './files.js';
import * as path from "node:path";

// ESM specific features - create __dirname equivalent
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Compute cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

// Analyze similarity between all products
async function analyzeSimilarity(
    embeddingField,
    threshold: number = 0.8,
    data: JsonData[]
): Promise<{ data1: string; data2: string; similarity: number }[]> {

    // Compare all products
    const similarPairs: { data1: string; data2: string; similarity: number }[] = [];
    for (let i = 0; i < data.length; i++) {
        for (let j = i + 1; j < data.length; j++) {
            const similarity = cosineSimilarity(
                data[i][embeddingField]!,
                data[j][embeddingField]!
            );
            if (similarity > threshold) {
                similarPairs.push({
                    data1: data[i].name,
                    data2: data[j].name,
                    similarity,
                });
            }
        }
    }

    // Return the similar pairs as an in-memory JSON object
    return similarPairs;
}

// Main function
async function main() {

    const threshold = 0.9;
    const filePath = path.join(__dirname, config.data.fileWithVectors!);
    const data = await readFileReturnJson(filePath);

    // Analyze similarity and get the results
    const similarPairs = await analyzeSimilarity(config.embeddings.embeddedField,threshold, data);

    // order the results by `similarity` highest to lowest
    similarPairs.sort((a, b) => b.similarity - a.similarity);

    console.log(`Found ${similarPairs.length} similar pairs:`);

    await writeFileJson(path.join(__dirname, config.data.fileWithSimilarity!), similarPairs);
}

main().catch((error) => console.error(error));