import { MongoClient } from 'mongodb';
import { promises as fs } from 'fs';
import path from 'path';
import { readFileReturnJson } from './files.js';
import { AzureOpenAI } from 'openai/index.js';

// ESM specific features - create __dirname equivalent
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const query = "find a hotel by a lake with a mountain view";
const config = {
    connectionString: process.env.MONGO_CONNECTION_STRING!,
    dbName: "HotelSet",
    collectionName: "hotels_ivf_2",
    dataFile: process.env.DATA_FILE_WITH_VECTORS!,
    batchSize: parseInt(process.env.LOAD_SIZE_BATCH! || '100', 10),
    embeddingField: process.env.EMBEDDED_FIELD!,
    embeddedField: process.env.EMBEDDED_FIELD!,
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS!, 10),
    indexName: "vectorIndex_ivf"
};

const indexColumns = [
    "HotelId",
    "Category",
    "Description",
    "Description_fr"
];
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
const client = new MongoClient(config.connectionString, {
    // Performance optimizations
    maxPoolSize: 10,         // Limit concurrent connections
    minPoolSize: 1,          // Maintain at least one connection
    maxIdleTimeMS: 30000,    // Close idle connections after 30 seconds
    connectTimeoutMS: 30000, // Connection timeout
    socketTimeoutMS: 360000, // Socket timeout (for long-running operations)
    writeConcern: {          // Optimize write concern for bulk operations
        w: 1,                // Acknowledge writes after primary has written
        j: false             // Don't wait for journal commit
    }
});
async function insertData(collection, data) {
    console.log(`Processing in batches of ${config.batchSize}...`);
    const totalBatches = Math.ceil(data.length / config.batchSize);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < totalBatches; i++) {
        const start = i * config.batchSize;
        const end = Math.min(start + config.batchSize, data.length);
        const batch = data.slice(start, end);

        try {
            const result = await collection.insertMany(batch, { ordered: false });
            inserted += result.insertedCount || 0;
            console.log(`Batch ${i + 1} complete: ${result.insertedCount} inserted`);
        } catch (error: any) {
            if (error?.writeErrors) {
                // Some documents may have been inserted despite errors
                console.error(`Error in batch ${i + 1}: ${error?.writeErrors.length} failures`);
                failed += error?.writeErrors.length;
                inserted += batch.length - error?.writeErrors.length;
            } else {
                console.error(`Error in batch ${i + 1}:`, error);
                failed += batch.length;
            }
        }

        // Small pause between batches to reduce resource contention
        if (i < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    for (const col of indexColumns) {
        const indexSpec = {};
        indexSpec[col] = 1; // Ascending index
        await collection.createIndex(indexSpec);
    }

    return { total: data.length, inserted, updated, skipped, failed };
}
function printSearchResults(insertSummary, indexSummary, searchResults) {
    console.log('--- Summary ---');
    console.log(`Data Load: ${JSON.stringify(insertSummary)}`);
    console.log(`Index Creation: ${JSON.stringify(indexSummary)}`);
    //console.log(`Search Results: ${JSON.stringify(searchResults)}`);
    if (searchResults) {
        //console.log(`Raw results: ${JSON.stringify(searchResults, null, 2)}`);

        // Process results to combine document fields with score
        const processedResults = searchResults.map(result => {
            // Extract the document and score
            const { document, score } = result as any;

            // Return combined object with all document fields and score
            return {
                ...document,
                score
            };
        });

        processedResults.forEach((result, index) => {
            console.log(`${index + 1}. HotelName: ${result.HotelName}, Score: ${result.score.toFixed(4)}`);
            //console.log(`   Description: ${result.Description}`);
        });

    }
}

async function main() {


    try {
        await client.connect();
        const db = client.db(config.dbName);
        const collection = await db.createCollection(config.collectionName);
        const data = await readFileReturnJson(path.join(__dirname, "..", config.dataFile));
        const insertSummary = await insertData(collection, data);

        // Create the vector index
        const indexOptions = {
            createIndexes: config.collectionName,
            indexes: [
                {
                    name: config.indexName,
                    key: {
                        [config.embeddedField]: 'cosmosSearch'
                    },
                    cosmosSearchOptions: {
                        kind: 'vector-ivf',
                        numLists: 1,
                        similarity: 'COS',
                        dimensions: config.embeddingDimensions
                    }
                }
            ]
        };
        const vectorIndexSummary = await db.command(indexOptions);

        // Create embedding for the query
        const createEmbeddedForQueryResponse = await aiClient.embeddings.create({
            model: deployment,
            input: [query]
        });

        // Perform the vector similarity search
        const searchResults = await collection.aggregate([
            {
                $search: {
                    cosmosSearch: {
                        vector: createEmbeddedForQueryResponse.data[0].embedding,
                        path: config.embeddedField,
                        k: 5
                    },
                    returnStoredSource: true
                }
            },
            {
                $project: {
                    score: {
                        $meta: "searchScore"
                    },
                    document: "$$ROOT"
                }
            }

        ]).toArray();

        // Print the results
        printSearchResults(insertSummary, vectorIndexSummary, searchResults);

    } catch (error) {
        console.error('App failed:', error);
        process.exitCode = 1;
    } finally {
        console.log('Closing database connection...');
        await client.close();
        console.log('Database connection closed');
    }
}

// Execute the main function
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exitCode = 1;
});