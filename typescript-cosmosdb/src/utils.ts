import { CosmosClient } from '@azure/cosmos';
import { AzureOpenAI } from 'openai/index.js';
import { promises as fs } from "fs";

// Define a type for JSON data
export type JsonData = Record<string, any>;

export function getClients(): { aiClient: AzureOpenAI; dbClient: CosmosClient } {
    const apiKey = process.env.AZURE_OPENAI_EMBEDDING_KEY!;
    const apiVersion = process.env.AZURE_OPENAI_EMBEDDING_API_VERSION!;
    const endpoint = process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT!;
    const deployment = process.env.AZURE_OPENAI_EMBEDDING_MODEL!;

    const aiClient = new AzureOpenAI({
        apiKey,
        apiVersion,
        endpoint,
        deployment
    });

    // Cosmos DB connection string or endpoint/key
    // You may need to use endpoint and key separately for CosmosClient
    const cosmosEndpoint = process.env.COSMOS_ENDPOINT!;
    const cosmosKey = process.env.COSMOS_KEY!;
    const dbClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
    return { aiClient, dbClient };
}
export async function readFileReturnJson(filePath: string): Promise<JsonData[]> {

    console.log(`Reading JSON file from ${filePath}`);

    const fileAsString = await fs.readFile(filePath, "utf-8");
    return JSON.parse(fileAsString);
}
export async function writeFileJson(filePath: string, jsonData: JsonData): Promise<void> {
    const jsonString = JSON.stringify(jsonData, null, 2);
    await fs.writeFile(filePath, jsonString, "utf-8");

    console.log(`Wrote JSON file to ${filePath}`);
}
export async function insertData(config, container, data) {
    // Cosmos DB uses containers instead of collections
    // Insert documents in batches
    console.log(`Processing in batches of ${config.batchSize}...`);
    const totalBatches = Math.ceil(data.length / config.batchSize);

    let inserted = 0;
    let failed = 0;
    // Cosmos DB does not support bulk insert natively in SDK, but you can use stored procedures or loop
    // Here we use a simple loop for demonstration
    for (let i = 0; i < totalBatches; i++) {
        const start = i * config.batchSize;
        const end = Math.min(start + config.batchSize, data.length);
        const batch = data.slice(start, end);
        for (const doc of batch) {
            try {
                await container.items.create(doc);
                inserted++;
            } catch (error) {
                console.error(`Error inserting document:`, error);
                failed++;
            }
        }
        // Small pause between batches to reduce resource contention
        if (i < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    // Index creation is handled by indexing policy in Cosmos DB, not programmatically per field
    //TBD: If custom indexing policy is needed, update container indexing policy via SDK or portal
    return { total: data.length, inserted, failed };
}
