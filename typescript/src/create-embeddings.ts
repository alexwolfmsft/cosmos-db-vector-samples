/**
 * Module for creating embedding vectors using OpenAI API
 * Supports text embedding models for generating embeddings
 * that can be used with Cosmos DB MongoDB vCore vector search
 */
import * as path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { AzureOpenAI } from "openai";
import { Embedding } from "openai/resources";
import { config } from './config.js';

// ESM specific features - create __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const appConfig = config;

// Define a type for items that will have embeddings added
interface Item {
    [key: string]: any;
}

export function createAzureOpenAIClient(): AzureOpenAI {
    return new AzureOpenAI({
        apiKey: appConfig.project.key,
        apiVersion: appConfig.model_embedding.apiVersion,
        endpoint: appConfig.model_embedding.endpoint,
        deployment: appConfig.model_embedding.deployment
    });
}

async function createEmbeddings(client: AzureOpenAI, items: string[]): Promise<Embedding[]> {
    const response = await client.embeddings.create({
        model: appConfig.model_embedding.deployment,
        input: items
    });

    if (!response.data || response.data.length === 0) {
        throw new Error(`No embedding data returned`);
    }
    return response.data;
}

/**
 * Creates embeddings for a batch of items and adds them as a new property
 * @param items Array of items to process
 * @param fieldToEmbed Name of the field to extract text from
 * @param newEmbeddedField Name of the field to store embeddings in
 * @returns Array of items with embeddings added
 */
export async function processEmbeddingBatch<T extends Item>(
    client: AzureOpenAI,
    items: T[],
    fieldToEmbed: string,
    newEmbeddedField: string,
    maxEmbeddings: number
): Promise<T[]> {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Items must be a non-empty array");
    }

    // Create a deep copy of the items array to avoid modifying the original
    const itemsWithEmbeddings: T[] = items.map(item => ({ ...item }));

    maxEmbeddings = maxEmbeddings || items.length;

    // Process in batches to avoid rate limits and memory issues
    for (let i = 0; i < maxEmbeddings; i += appConfig.model_embedding.batchSize) {
        const batchEnd = Math.min(i + appConfig.model_embedding.batchSize, items.length);
        console.log(`Processing batch: ${i} to ${batchEnd - 1} (of ${items.length} items)`);

        // Extract the text to embed from each item in the batch
        const batchItems = items.slice(i, batchEnd);
        const textsToEmbed = batchItems.map(item => {
            if (!item[fieldToEmbed]) {
                console.warn(`Item is missing the field to embed: ${fieldToEmbed}`);
                // Provide a fallback value to prevent API errors
                return "";
            }
            return item[fieldToEmbed];
        });

        try {
            // Generate embeddings for the batch of texts
            const embeddings = await createEmbeddings(client, textsToEmbed);


            // Add the embeddings back to the corresponding items
            embeddings.forEach((embeddingData, index) => {
                const itemIndex = i + index;
                if (itemIndex < itemsWithEmbeddings.length) {
                    // Add the embedding as a new property with the specified name
                    // Use type assertion to safely add the property
                    (itemsWithEmbeddings[itemIndex] as any)[newEmbeddedField] = embeddingData.embedding;
                }
            });

            // Add a small delay between batches to avoid rate limiting
            if (batchEnd < items.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } catch (error) {
            console.error(`Error generating embeddings for batch ${i}:`, error);
            throw error;
        }
    }

    return itemsWithEmbeddings;
}

const client = createAzureOpenAIClient();
const dataFile = path.join(__dirname, "..", appConfig.data.file);
console.log(`Loading data from ${dataFile}`);

const dataAsString = await fs.readFile(dataFile, "utf-8");
const data = JSON.parse(dataAsString);

const maxEmbeddings=3;

const embeddings = await processEmbeddingBatch(client, data, config.embeddings.fieldToEmbed, config.embeddings.embeddedField, maxEmbeddings);

console.log(embeddings[0][config.embeddings.embeddedField]);