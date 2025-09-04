/**
 * Module for creating embedding vectors using OpenAI API
 * Supports text embedding models for generating embeddings
 * that can be used with Cosmos DB MongoDB vCore vector search
 */
import * as path from "node:path";
import { AzureOpenAI } from "openai";
import { Embedding } from "openai/resources";
import { config } from './config.js';
import { readFileReturnJson, writeFileJson, JsonData } from "./files.js";

// ESM specific features - create __dirname equivalent
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const appConfig = config;

const apiKey = process.env.AZURE_OPENAI_EMBEDDING_KEY;
const apiVersion = process.env.AZURE_OPENAI_EMBEDDING_API_VERSION;
const endpoint = process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT;
console.log(`Using OpenAI endpoint: ${endpoint}`);
const deployment = process.env.AZURE_OPENAI_EMBEDDING_MODEL;

// Define a reusable delay function
async function delay(ms: number = config.request.timeout || 200): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
}

await delay();

export function createAzureOpenAIClient(): AzureOpenAI {


    const config = {
        apiKey,
        apiVersion,
        endpoint,
        deployment
    };
    console.log("Azure OpenAI Client Config:", config);

    return new AzureOpenAI(config);
}

export async function createEmbeddings(client: AzureOpenAI, model: string, inputItems: string[]): Promise<Embedding[]> {
    const response = await client.embeddings.create({
        model,
        input: inputItems
    });

    if (!response.data || response.data.length === 0) {
        throw new Error(`No embedding data returned`);
    }
    return response.data;
}

export async function processEmbeddingBatch<T>(
    client: AzureOpenAI,
    model: string,
    fieldToEmbed: string,
    newEmbeddedField: string,
    maxEmbeddings: number,
    items: T[]

): Promise<T[]> {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Items must be a non-empty array");
    }

    if (!fieldToEmbed) {
        throw new Error("Field to embed must be specified");
    }

    const itemsWithEmbeddings: T[] = [];
    maxEmbeddings = maxEmbeddings || items.length;

    // Process in batches to avoid rate limits and memory issues
    for (let i = 0; i < maxEmbeddings; i += appConfig.model_embedding.batchSize) {
        const batchEnd = Math.min(i + appConfig.model_embedding.batchSize, items.length);
        console.log(`Processing batch: ${i} to ${batchEnd - 1} (of ${items.length} items)`);

        const batchItems = items.slice(i, batchEnd);
        const textsToEmbed = batchItems.map(item => {
            if (!item[fieldToEmbed]) {
                console.warn(`Item is missing the field to embed: ${fieldToEmbed}`);
                return ""; // Provide a fallback value to prevent API errors
            }
            return item[fieldToEmbed];
        });

        try {
            const embeddings = await createEmbeddings(client, model, textsToEmbed);

            embeddings.forEach((embeddingData, index) => {
                const originalItem = batchItems[index];
                const newItem = {
                    ...originalItem,
                    [newEmbeddedField]: embeddingData.embedding
                };
                itemsWithEmbeddings.push(newItem);
            });

            // Add a small delay between batches to avoid rate limiting
            if (batchEnd < items.length) {
                await delay();
            }
        } catch (error) {
            console.error(`Error generating embeddings for batch ${i}:`, error);
            throw error;
        }
    }

    return itemsWithEmbeddings;
}


try {

    const client = createAzureOpenAIClient();

    const data = await readFileReturnJson(path.join(__dirname, "..", appConfig.data.file!));
    const model = config.model_embedding.deployment;
    const fieldToEmbed = config.embeddings.fieldToEmbed;
    const newEmbeddedField = config.embeddings.embeddedField;
    const maxEmbeddings = data.length; // Or set to a specific number for testing

    const embeddings = await processEmbeddingBatch<JsonData>(
        client,
        model,
        fieldToEmbed,
        newEmbeddedField,
        maxEmbeddings,
        data
    );

    await writeFileJson(path.join(__dirname, "..", appConfig.data.fileWithVectors!), embeddings);

} catch (error) {
    console.error(`Failed to save embeddings to file: ${(error as Error).message}`);
}