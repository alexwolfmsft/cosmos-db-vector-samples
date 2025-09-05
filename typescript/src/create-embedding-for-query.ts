/**
 * Module for creating embedding vectors using OpenAI API
 * Supports text embedding models for generating embeddings
 * that can be used with Cosmos DB MongoDB vCore vector search
 */
import * as path from "node:path";
import { AzureOpenAI } from "openai";
import { writeFileJson } from "./files.js";

// ESM specific features - create __dirname equivalent
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const timestamp = Date.now(); // Numeric timestamp in milliseconds

const apiKey = process.env.AZURE_OPENAI_EMBEDDING_KEY;
const apiVersion = process.env.AZURE_OPENAI_EMBEDDING_API_VERSION;
const endpoint = process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT;
const deployment = process.env.AZURE_OPENAI_EMBEDDING_MODEL!;

const dataFolder = process.env.DATA_FOLDER!;

try {

    const client = new AzureOpenAI({
        apiKey,
        apiVersion,
        endpoint,
        deployment
    });
    
    const query = "find a hotel by a lake with a mountain view";

    const response = await client.embeddings.create({
        model: deployment,
        input: [query]
    });

    if (!response.data || response.data.length === 0) {
        throw new Error(`No embedding data returned`);
    }

    response.data[0]["query"] = query; 

    await writeFileJson(path.join(__dirname, "..", dataFolder, "HotelsData_Query_Vector_mountain_view.json"), response.data);

} catch (error) {
    console.error(`Failed to save embeddings to file: ${(error as Error).message}`);
}